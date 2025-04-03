import React, { useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { SVGShape, NFTMetadata } from '../types';
import { extractShapesFromSVG, applyMaskToImage } from '../utils/svgProcessor';
import { useNFTOwnership } from '../hooks/useNFTOwnership';

interface SVGUploaderProps {
  onSVGLoad: (shapes: SVGShape[], svgUrl: string) => void;
  selectedNfts?: (NFTMetadata | undefined)[];
  walletAddress?: string;
  onCellDrop?: (cellIndex: number, nft: NFTMetadata | undefined) => void;
  selectedTokenId?: string;
  onTokenIdChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const SVGUploader: React.FC<SVGUploaderProps> = ({ 
  onSVGLoad, 
  selectedNfts = [], 
  walletAddress,
  onCellDrop,
  selectedTokenId,
  onTokenIdChange
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
      
      // Sélectionner automatiquement le premier token ID si aucun n'est sélectionné
      if ((!selectedTokenId || selectedTokenId === '') && onTokenIdChange && tokenIds.length > 0) {
        const event = {
          target: { value: tokenIds[0] }
        } as React.ChangeEvent<HTMLSelectElement>;
        onTokenIdChange(event);
      }
    }
  }, [isOwner, tokenIds, selectedTokenId, onTokenIdChange]);

  const renderPreview = async (svgContent: string, svgShapes: SVGShape[], selectedNfts: (NFTMetadata | undefined)[]) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const viewBox = svgShapes.length > 0 ? svgShapes[0].viewBox : { minX: 0, minY: 0, width: 100, height: 100 };
    
    // Ajuster la taille du canvas à la taille du SVG
    canvas.width = 400;
    canvas.height = 400 * (viewBox.height / viewBox.width);

    // Calculer l'échelle pour adapter le SVG au canvas
    const scale = canvas.width / viewBox.width;

    // Effacer complètement le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Remplir avec un fond blanc pour s'assurer que tout est effacé
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Utiliser directement le token ID sélectionné s'il est disponible
    let tokenId = selectedTokenId || '1';
    
    // Si le token ID n'est pas défini, essayer de l'extraire du SVG
    if (!tokenId || tokenId === '') {
      try {
        // Extraire le token ID du contenu SVG
        const svgMatch = svgContent.match(/mask_(\d+)\.svg/);
        if (svgMatch && svgMatch[1]) {
          tokenId = svgMatch[1];
          console.log(`Token ID détecté depuis le SVG (pattern): ${tokenId}`);
        } 
        // Sinon, rechercher dans l'URL si disponible
        else {
          const urlMatch = window.location.href.match(/token[Ii]d=(\d+)/);
          if (urlMatch && urlMatch[1]) {
            tokenId = urlMatch[1];
            console.log(`Token ID détecté depuis l'URL: ${tokenId}`);
          } else {
            console.warn("Impossible de détecter le token ID, utilisation de la valeur par défaut: 1");
          }
        }
      } catch (err) {
        console.warn('Impossible de détecter le token ID:', err);
      }
    } else {
      console.log(`Utilisation du token ID sélectionné pour l'aperçu: ${tokenId}`);
    }

    // Forcer le token ID à être une chaîne de caractères
    tokenId = String(tokenId);
    console.log(`Token ID final pour le chargement de l'image d'alvéoles: ${tokenId}`);

    // Définir explicitement l'URL de l'image d'alvéoles
    const baseUrl = window.location.origin;
    const alveoleUrl = `${baseUrl}/svg/alveoles_${tokenId}.png?t=${Date.now()}`;
    console.log(`URL de l'image d'alvéoles à charger: ${alveoleUrl}`);

    // Charger d'abord l'image d'alvéoles complète en arrière-plan
    try {
      const alveoleImg = new Image();
      alveoleImg.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolveAlveole) => {
        const timeoutId = setTimeout(() => {
          console.warn(`Timeout lors du chargement de l'image d'alvéoles`);
          resolveAlveole();
        }, 5000);
        
        alveoleImg.onload = () => {
          clearTimeout(timeoutId);
          console.log(`Image d'alvéoles chargée avec succès: alveoles_${tokenId}.png`);
          // Dessiner l'image d'alvéoles complète en arrière-plan
          ctx.save();
          ctx.scale(scale, scale);
          ctx.translate(-viewBox.minX, -viewBox.minY);
          ctx.drawImage(alveoleImg, viewBox.minX, viewBox.minY, viewBox.width, viewBox.height);
          ctx.restore();
          resolveAlveole();
        };
        
        alveoleImg.onerror = () => {
          clearTimeout(timeoutId);
          console.error(`Erreur lors du chargement de l'image d'alvéoles complète: alveoles_${tokenId}.png`);
          resolveAlveole();
        };
        
        alveoleImg.src = alveoleUrl;
      });
    } catch (err) {
      console.error('Erreur lors du chargement de l\'image d\'alvéoles complète:', err);
    }

    // Dessiner le SVG par-dessus
    const img = new Image();
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
      img.onload = async () => {
        try {
          // Dessiner le SVG par-dessus l'image d'alvéoles
          ctx.save();
          ctx.scale(scale, scale);
          ctx.translate(-viewBox.minX, -viewBox.minY);
          
          // Dessiner uniquement les contours du SVG (pas de remplissage)
          ctx.drawImage(img, viewBox.minX, viewBox.minY, viewBox.width, viewBox.height);

          // Dessiner les NFTs dans les cellules
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
              // Afficher uniquement le numéro de la cellule si aucun NFT n'est associé
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
    if (svgPreview && shapes.length > 0 && selectedNfts) {
      console.log('Mise à jour de l\'aperçu SVG avec les nouveaux NFTs:', selectedNfts);
      renderPreview(svgPreview, shapes, selectedNfts).catch(err => {
        console.error('Error updating preview:', err);
      });
    }
  }, [svgPreview, shapes, selectedNfts]);

  useEffect(() => {
    if (svgPreview && shapes.length > 0 && selectedTokenId) {
      console.log(`Token ID changé, mise à jour de l'aperçu: ${selectedTokenId}`);
      renderPreview(svgPreview, shapes, selectedNfts).catch(err => {
        console.error('Erreur lors de la mise à jour de l\'aperçu après changement de token ID:', err);
      });
    }
  }, [selectedTokenId]);

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
          
          // Créer une URL pour le SVG
          const blob = new Blob([text], { type: 'image/svg+xml' });
          const svgUrl = URL.createObjectURL(blob);
          
          // Passer les formes extraites et l'URL du SVG au composant parent
          onSVGLoad(extractedShapes, svgUrl);
          
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
      console.log(`Chargement du SVG pour le token ID: ${tokenId}`);
      setVerificationStatus(`Chargement du SVG pour le token ID: ${tokenId}...`);
      setError('');
      
      // Réinitialiser l'état pour vider l'aperçu
      setShapes([]);
      setSvgPreview(null);
      
      // Utiliser l'URL complète avec le chemin de base de l'application
      const baseUrl = window.location.origin;
      const svgPath = `${baseUrl}/svg/mask_${tokenId}.svg?t=${Date.now()}`;
      console.log(`Tentative de chargement du SVG depuis: ${svgPath}`);
      
      // Vérifier si le fichier existe dans le dossier public
      const response = await fetch(svgPath);
      
      if (!response.ok) {
        throw new Error(`Impossible de charger le SVG pour le token ID ${tokenId}`);
      }
      
      const svgContent = await response.text();
      
      // Vérifier que le contenu SVG est valide
      if (!svgContent || svgContent.trim() === '' || !svgContent.includes('<svg')) {
        throw new Error('Le fichier ne semble pas être un SVG valide');
      }
      
      // Extraire les formes du SVG
      const extractedShapes = extractShapesFromSVG(svgContent);
      
      if (extractedShapes.length === 0) {
        throw new Error('Aucune forme n\'a été trouvée dans le SVG');
      }
      
      // Mettre à jour l'état
      setShapes(extractedShapes);
      onSVGLoad(extractedShapes, svgPath);
      setSvgPreview(svgContent);
      
      // Rendre l'aperçu
      await renderPreview(svgContent, extractedShapes, []);
      
      setVerificationStatus(`SVG chargé avec succès pour le token ID: ${tokenId}`);
      return extractedShapes;
    } catch (error) {
      console.error("Erreur lors du chargement du SVG:", error);
      setError(`Erreur lors du chargement du SVG: ${error instanceof Error ? error.message : String(error)}`);
      setSvgPreview(null);
      return null;
    }
  };

  const handleVerifyNFTOwnership = async () => {
    if (!walletAddress) {
      setError('Veuillez connecter votre wallet pour vérifier la propriété NFT');
      return;
    }
    
    setCheckingNFT(true);
    setError('');
    setVerificationStatus('Vérification de la propriété NFT...');
    
    try {
      console.log(`Vérification de la propriété NFT pour l'adresse: ${walletAddress}`);
      const result = await checkOwnership(walletAddress);
      
      if (result.isOwner && result.tokenIds.length > 0) {
        console.log(`Propriété NFT vérifiée! Token IDs: ${result.tokenIds.join(', ')}`);
        setVerificationStatus(`NFT trouvé! Token IDs: ${result.tokenIds.join(', ')}`);
        
        // Si un token ID est sélectionné automatiquement, cela déclenchera le chargement du SVG
        if (result.tokenIds.length > 0) {
          const firstTokenId = result.tokenIds[0];
          console.log(`Sélection automatique du token ID: ${firstTokenId}`);
          
          // Mettre à jour le token ID sélectionné
          if (onTokenIdChange) {
            const event = {
              target: { value: firstTokenId }
            } as React.ChangeEvent<HTMLSelectElement>;
            onTokenIdChange(event);
          }
          
          // Charger directement le SVG
          await loadSVGFromPublic(firstTokenId);
        }
      } else {
        console.log('Aucun NFT trouvé pour cette collection');
        setVerificationStatus('Aucun NFT trouvé pour cette collection');
      }
    } catch (err) {
      console.error('Erreur lors de la vérification de propriété NFT:', err);
      setError(`Erreur lors de la vérification: ${err instanceof Error ? err.message : String(err)}`);
      setVerificationStatus('');
    } finally {
      setCheckingNFT(false);
    }
  };

  useEffect(() => {
    if (selectedTokenId && isOwner) {
      loadSVGFromPublic(selectedTokenId);
    }
  }, [selectedTokenId, isOwner]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto p-4 bg-white rounded-lg shadow-md">
        {/* Section de vérification NFT */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium mb-2">Vérification de propriété NFT</h3>
          <p className="text-sm text-gray-600 mb-3">
            Connectez votre wallet et vérifiez si vous possédez un NFT de la collection pour charger automatiquement votre SVG.
          </p>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleVerifyNFTOwnership}
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
                          border: isDragOver 
                            ? '2px dashed #4f46e5' 
                            : isOccupied 
                              ? '2px solid rgba(79, 70, 229, 0.3)' 
                              : '2px solid transparent',
                          backgroundColor: isDragOver 
                            ? 'rgba(79, 70, 229, 0.1)' 
                            : 'transparent',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          cursor: isOccupied ? 'default' : 'pointer',
                          zIndex: 10
                        }}
                      >
                        {isOccupied && (
                          <button
                            onClick={() => onCellDrop && onCellDrop(index, undefined)}
                            style={{
                              position: 'absolute',
                              top: '5px',
                              right: '5px',
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(255, 0, 0, 0.7)',
                              color: 'white',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              border: 'none',
                              zIndex: 20
                            }}
                            title="Supprimer le NFT"
                          >
                            ✕
                          </button>
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
        
        {/* Sélecteur de token ID */}
        {isOwner && tokenIds.length > 0 && (
          <div className="mt-4">
            <label htmlFor="tokenIdSelector" className="block text-sm font-medium text-gray-700 mb-1">
              Sélectionner un Token ID
            </label>
            <select
              id="tokenIdSelector"
              value={selectedTokenId}
              onChange={onTokenIdChange}
              className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {tokenIds.map((tokenId) => (
                <option key={tokenId} value={tokenId}>
                  Token ID: {tokenId}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};