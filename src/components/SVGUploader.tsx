import React, { useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { SVGShape, NFTMetadata } from '../types';
import { extractShapesFromSVG, applyMaskToImage } from '../utils/svgProcessor';
import { useNFTOwnership } from '../hooks/useNFTOwnership';

interface SVGUploaderProps {
  onSVGLoad: (shapes: SVGShape[]) => void;
  selectedNfts?: NFTMetadata[];
  walletAddress?: string;
  onCellDrop?: (cellIndex: number, nft: NFTMetadata) => void;
}

export const SVGUploader: React.FC<SVGUploaderProps> = ({ 
  onSVGLoad, 
  selectedNfts = [], 
  walletAddress,
  onCellDrop 
}) => {
  const [error, setError] = React.useState<string>('');
  const [svgPreview, setSvgPreview] = React.useState<string | null>(null);
  const previewCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [shapes, setShapes] = React.useState<SVGShape[]>([]);
  const { isOwner, tokenIds, checkOwnership } = useNFTOwnership();
  const [checkingNFT, setCheckingNFT] = React.useState<boolean>(false);
  const [verificationStatus, setVerificationStatus] = React.useState<string>('');
  const [showDragDrop] = React.useState<boolean>(false);
  const [dragOverCell, setDragOverCell] = React.useState<number | null>(null);

  // Fonction pour gérer le drop d'un NFT sur une cellule
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, cellIndex: number) => {
    e.preventDefault();
    setDragOverCell(cellIndex);
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, cellIndex: number) => {
    e.preventDefault();
    setDragOverCell(null);
    
    try {
      const nftData = JSON.parse(e.dataTransfer.getData('application/json'));
      if (nftData && onCellDrop) {
        onCellDrop(cellIndex, nftData);
      }
    } catch (err) {
      console.error('Erreur lors du drop:', err);
    }
  };

  useEffect(() => {
    if (isOwner && tokenIds.length > 0) {
      setError('');
      setVerificationStatus(`NFT trouvé! Token IDs: ${tokenIds.join(', ')}`);
    }
  }, [isOwner, tokenIds]);

  const renderPreview = async (svgContent: string, svgShapes: SVGShape[], selectedNfts: NFTMetadata[]) => {
    const canvas = previewCanvasRef.current;
    if (!canvas || svgShapes.length === 0) return;

    const viewBox = svgShapes[0].viewBox;
    const maxPreviewSize = 300;

    const scale = Math.min(
      maxPreviewSize / viewBox.width,
      maxPreviewSize / viewBox.height
    );

    canvas.width = viewBox.width * scale;
    canvas.height = viewBox.height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
      img.onload = async () => {
        try {
          ctx.save();
          
          ctx.scale(scale, scale);
          
          ctx.translate(-viewBox.minX, -viewBox.minY);
          
          ctx.drawImage(img, viewBox.minX, viewBox.minY, viewBox.width, viewBox.height);

          for (let i = 0; i < svgShapes.length; i++) {
            const shape = svgShapes[i];
            const selectedNft = selectedNfts[i];

            if (selectedNft) {
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = viewBox.width;
              tempCanvas.height = viewBox.height;

              const nftImage = new Image();
              nftImage.crossOrigin = 'anonymous';
              
              await new Promise<void>((resolveNft, rejectNft) => {
                nftImage.onload = async () => {
                  try {
                    await applyMaskToImage(nftImage, shape, tempCanvas);
                    
                    ctx.drawImage(tempCanvas, 0, 0);
                    resolveNft();
                  } catch (err) {
                    console.error('Erreur lors de l\'application du masque:', err);
                    rejectNft(err);
                  }
                };
                nftImage.onerror = () => {
                  console.error('Erreur lors du chargement de l\'image NFT');
                  rejectNft(new Error('Erreur lors du chargement de l\'image NFT'));
                };
                nftImage.src = selectedNft.imageUrl + `?t=${Date.now()}`;
              });
            } else {
              const minDimension = Math.min(shape.bounds.width, shape.bounds.height);
              const fontSize = Math.max(12, Math.min(minDimension * 0.3, 24));
              
              ctx.save();
              ctx.font = `bold ${fontSize}px Arial`;
              ctx.fillStyle = 'white';
              ctx.strokeStyle = 'black';
              ctx.lineWidth = Math.max(2, fontSize * 0.1);
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';

              const text = (i + 1).toString();
              const x = shape.center.x;
              const y = shape.center.y;

              ctx.strokeText(text, x, y);
              ctx.fillText(text, x, y);
              ctx.restore();
            }
          }

          ctx.restore();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load SVG preview'));
      img.src = url;
    }).finally(() => {
      URL.revokeObjectURL(url);
    });
  };

  useEffect(() => {
    if (svgPreview && shapes.length > 0) {
      renderPreview(svgPreview, shapes, selectedNfts).catch(err => {
        console.error('Error updating preview:', err);
      });
    }
  }, [svgPreview, shapes, selectedNfts]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/svg+xml': ['.svg']
    },
    multiple: false,
    onDrop: async (acceptedFiles) => {
      try {
        setError('');
        const file = acceptedFiles[0];
        if (file) {
          const text = await file.text();
          const extractedShapes = extractShapesFromSVG(text);
          setShapes(extractedShapes);
          onSVGLoad(extractedShapes);
          setSvgPreview(text);
          await renderPreview(text, extractedShapes, []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process SVG file');
        setSvgPreview(null);
      }
    }
  });

  // Fonction pour charger un SVG depuis le dossier public/svg
  const loadSVGFromPublic = async (tokenId: string) => {
    try {
      console.log(`===== DÉBUT DU CHARGEMENT DU SVG POUR TOKEN ID: ${tokenId} =====`);
      setVerificationStatus(`Chargement du SVG pour le token ID: ${tokenId}...`);
      setError('');
      
      // Utiliser l'URL complète avec le chemin de base de l'application
      const baseUrl = window.location.origin;
      const svgPath = `${baseUrl}/svg/mask_${tokenId}.svg`;
      console.log(`Tentative de chargement du SVG depuis: ${svgPath}`);
      
      // Vérifier si le fichier existe dans le dossier public
      try {
        const response = await fetch(svgPath, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        console.log(`Statut de la réponse: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          throw new Error(`Impossible de charger le SVG pour le token ID ${tokenId} (${response.status} ${response.statusText})`);
        }
        
        const svgContent = await response.text();
        console.log(`SVG chargé avec succès, taille: ${svgContent.length} caractères`);
        console.log(`Début du contenu SVG: ${svgContent.substring(0, 100)}...`);
        
        // Vérifier que le contenu SVG est valide
        if (!svgContent || svgContent.trim() === '') {
          throw new Error('Le fichier SVG est vide');
        }
        
        if (!svgContent.includes('<svg')) {
          throw new Error('Le fichier ne semble pas être un SVG valide');
        }
        
        // Extraire les formes du SVG
        console.log('Extraction des formes du SVG...');
        const extractedShapes = extractShapesFromSVG(svgContent);
        console.log('Extraction terminée, résultat:', extractedShapes);
        
        if (extractedShapes.length === 0) {
          throw new Error('Aucune forme n\'a été trouvée dans le SVG');
        }
        
        console.log(`Formes extraites: ${extractedShapes.length}`);
        
        // Mettre à jour l'état dans le même ordre que dans onDrop
        console.log('Mise à jour de l\'état...');
        setShapes(extractedShapes);
        onSVGLoad(extractedShapes);
        setSvgPreview(svgContent);
        
        // Attendre que l'état soit mis à jour
        console.log('Attente de la mise à jour de l\'état...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Rendre l'aperçu
        console.log('Rendu de l\'aperçu SVG...');
        console.log('État actuel: shapes =', shapes.length, 'svgPreview =', svgPreview ? 'présent' : 'absent');
        console.log('Canvas disponible:', previewCanvasRef.current ? 'oui' : 'non');
        
        // Utiliser les formes extraites directement plutôt que de compter sur l'état mis à jour
        await renderPreview(svgContent, extractedShapes, []);
        console.log('Rendu terminé avec succès');
        
        setVerificationStatus(`SVG chargé avec succès pour le token ID: ${tokenId}`);
        console.log(`===== FIN DU CHARGEMENT DU SVG POUR TOKEN ID: ${tokenId} =====`);
        return extractedShapes;
      } catch (fetchError) {
        console.error("Erreur lors du fetch du SVG:", fetchError);
        
        // Afficher la liste des fichiers disponibles dans le dossier public/svg
        console.log("Vérification des fichiers disponibles dans le dossier public/svg...");
        try {
          const response = await fetch(`${baseUrl}/svg/`);
          console.log("Réponse du dossier:", response.status, response.statusText);
        } catch (dirError) {
          console.error("Impossible de lister le dossier:", dirError);
        }
        
        throw fetchError;
      }
    } catch (error) {
      console.error("Erreur lors du chargement du SVG:", error);
      setError(`Erreur lors du chargement du SVG: ${error instanceof Error ? error.message : String(error)}`);
      setSvgPreview(null);
      console.log(`===== ÉCHEC DU CHARGEMENT DU SVG POUR TOKEN ID: ${tokenId} =====`);
      return null;
    }
  };

  const handleCheckNFT = async () => {
    if (!walletAddress) {
      setError("Veuillez connecter votre wallet pour vérifier la propriété NFT");
      return;
    }

    try {
      setCheckingNFT(true);
      setError('');
      setVerificationStatus("Vérification de la propriété NFT...");

      console.log("=== DÉBUT DE LA VÉRIFICATION NFT ===");
      console.log("Adresse du wallet:", walletAddress);
      console.log("État initial - isOwner:", isOwner, "tokenIds:", tokenIds);

      // Vérifier la propriété NFT et récupérer les résultats directement
      const result = await checkOwnership(walletAddress);
      
      console.log("Résultats de checkOwnership:", result);
      console.log("État après checkOwnership - isOwner:", isOwner, "tokenIds:", tokenIds);
      
      // Utiliser les résultats retournés directement par le hook
      if (result.isOwner && result.tokenIds.length > 0) {
        console.log(`NFT trouvé! Token IDs: ${result.tokenIds.join(', ')}`);
        setVerificationStatus(`NFT trouvé! Token IDs: ${result.tokenIds.join(', ')}`);
        
        // Prendre le premier token ID trouvé
        const tokenId = result.tokenIds[0];
        console.log("Token ID sélectionné pour chargement:", tokenId);
        
        // Charger directement le SVG correspondant
        await loadSVGFromPublic(tokenId);
      } else {
        console.log(`Aucun NFT trouvé pour l'adresse ${walletAddress}`);
        setError("Aucun NFT trouvé pour cette adresse wallet");
        setVerificationStatus("Aucun NFT trouvé");
      }
      console.log("=== FIN DE LA VÉRIFICATION NFT ===");
    } catch (err) {
      console.error("Erreur lors de la vérification de propriété NFT:", err);
      setError(`Erreur lors de la vérification: ${err instanceof Error ? err.message : String(err)}`);
      setVerificationStatus("Échec de la vérification");
    } finally {
      setCheckingNFT(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto p-4 bg-white rounded-lg shadow-md">
        {/* Titre et lien masqués */}
        {/* <h2 className="text-xl font-semibold text-center">Chargeur de SVG</h2> */}
        
        {/* Bouton pour afficher/masquer le bloc de drag & drop - masqué */}
        {/* <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={() => setShowDragDrop(!showDragDrop)}
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            {showDragDrop ? "Masquer l'upload manuel" : "Afficher l'upload manuel"}
          </button>
        </div> */}
        
        {/* Section de vérification NFT */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium mb-2">Vérification de propriété NFT</h3>
          <p className="text-sm text-gray-600 mb-3">
            Connectez votre wallet et vérifiez si vous possédez un NFT de la collection pour charger automatiquement votre SVG.
          </p>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCheckNFT}
              disabled={!walletAddress || checkingNFT}
              className={`px-4 py-2 rounded-md ${!walletAddress || checkingNFT ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              {checkingNFT ? 'Vérification...' : 'Vérifier propriété NFT'}
            </button>
            
            {verificationStatus && (
              <span className={`text-sm ${error ? 'text-red-500' : 'text-green-600'}`}>
                {verificationStatus}
              </span>
            )}
          </div>
          
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>
        
        {/* Bloc de drag & drop (masqué) */}
        {showDragDrop && (
          <div
            {...getRootProps()}
            className={`p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center text-center">
              <Upload className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700">
                {isDragActive
                  ? 'Drop the SVG file here'
                  : 'Drag & drop an SVG file here, or click to select'}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Only SVG files with closed shapes are supported
              </p>
            </div>
          </div>
        )}
        
        {/* Aperçu du SVG avec zones de drop */}
        {svgPreview && (
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-2">Aperçu</h3>
            <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ height: '300px', width: '250px', margin: '0 auto' }}>
              <canvas
                ref={previewCanvasRef}
                className="absolute inset-0 w-full h-full"
              />
              
              {/* Zones de drop superposées sur le canvas */}
              {shapes.length > 0 && (
                <div className="absolute inset-0">
                  {shapes.map((shape, index) => {
                    const isOccupied = selectedNfts[index] !== undefined;
                    const isDragOver = dragOverCell === index;
                    
                    // Calculer la position relative dans le conteneur de preview
                    const previewWidth = 250;
                    const previewHeight = 300;
                    const viewBox = shape.viewBox;
                    
                    const scaleX = previewWidth / viewBox.width;
                    const scaleY = previewHeight / viewBox.height;
                    const scale = Math.min(scaleX, scaleY);
                    
                    const x = (shape.center.x - viewBox.minX) * scale;
                    const y = (shape.center.y - viewBox.minY) * scale;
                    const width = shape.bounds.width * scale;
                    const height = shape.bounds.height * scale;
                    
                    return (
                      <div
                        key={`drop-zone-${index}`}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        style={{
                          position: 'absolute',
                          left: x - width / 2,
                          top: y - height / 2,
                          width: width,
                          height: height,
                          borderRadius: '50%',
                          cursor: 'pointer',
                          backgroundColor: isDragOver ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                          border: isDragOver ? '2px dashed #3b82f6' : 'none',
                          zIndex: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {!isOccupied && !isDragOver && (
                          <span className="text-xs font-bold text-white bg-gray-800 bg-opacity-70 px-2 py-1 rounded-full">
                            {index + 1}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Instructions pour le drag & drop */}
            <p className="text-sm text-gray-500 mt-2 text-center">
              Glissez et déposez vos NFTs sur les cellules numérotées
            </p>
          </div>
        )}
      </div>
    </div>
  );
};