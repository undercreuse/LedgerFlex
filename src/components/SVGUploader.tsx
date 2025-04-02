import React, { useEffect, useState, useRef } from 'react';
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
  onTokenIdChange?: (tokenId: string) => void;
}

export const SVGUploader: React.FC<SVGUploaderProps> = ({ 
  onSVGLoad, 
  selectedNfts = [], 
  walletAddress,
  onCellDrop,
  onTokenIdChange
}) => {
  const [error, setError] = useState<string>('');
  const [svgPreview, setSvgPreview] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [shapes, setShapes] = useState<SVGShape[]>([]);
  const { isOwner, tokenIds, checkOwnership } = useNFTOwnership();
  const [checkingNFT, setCheckingNFT] = useState<boolean>(false);
  const [verificationStatus, setVerificationStatus] = useState<string>('');
  const [showDragDrop] = useState<boolean>(false);
  const [dragOverCell, setDragOverCell] = useState<number | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [showTokenSelector, setShowTokenSelector] = useState<boolean>(false);

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
      setVerificationStatus(`Cover Flex trouvé! Token IDs: ${tokenIds.join(', ')}`);
    }
  }, [isOwner, tokenIds]);

  // Fonction dédiée au chargement et à l'affichage de l'image d'alvéoles
  const loadAndDrawAlveoles = async (tokenId: string, canvas: HTMLCanvasElement, viewBox: { minX: number, minY: number, width: number, height: number }, scale: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    
    // Forcer le token ID à être une chaîne de caractères
    tokenId = String(tokenId);
    console.log(`loadAndDrawAlveoles - Chargement de l'image d'alvéoles pour le token ID: ${tokenId}`);
    
    // Définir explicitement l'URL de l'image d'alvéoles avec un paramètre de cache-busting
    const baseUrl = window.location.origin;
    const timestamp = Date.now();
    const alveoleUrl = `${baseUrl}/svg/alveoles_${tokenId}.png?forceReload=${timestamp}`;
    console.log(`loadAndDrawAlveoles - URL de l'image d'alvéoles: ${alveoleUrl}`);
    
    // Nous n'utilisons plus cette variable d'état, donc nous la supprimons
    // setCurrentAlveolesUrl(alveoleUrl);
    
    try {
      return await new Promise<boolean>((resolve) => {
        const alveoleImg = new Image();
        alveoleImg.crossOrigin = 'anonymous';
        
        const timeoutId = setTimeout(() => {
          console.warn(`loadAndDrawAlveoles - Timeout lors du chargement de l'image d'alvéoles`);
          resolve(false);
        }, 5000);
        
        alveoleImg.onload = () => {
          clearTimeout(timeoutId);
          console.log(`loadAndDrawAlveoles - Image d'alvéoles chargée avec succès: ${alveoleUrl}`);
          
          // Effacer le canvas avant de dessiner
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Dessiner l'image d'alvéoles
          ctx.save();
          ctx.scale(scale, scale);
          ctx.translate(-viewBox.minX, -viewBox.minY);
          ctx.drawImage(alveoleImg, viewBox.minX, viewBox.minY, viewBox.width, viewBox.height);
          ctx.restore();
          
          resolve(true);
        };
        
        alveoleImg.onerror = () => {
          clearTimeout(timeoutId);
          console.error(`loadAndDrawAlveoles - Erreur lors du chargement de l'image d'alvéoles: ${alveoleUrl}`);
          resolve(false);
        };
        
        // Désactiver le cache pour forcer le rechargement de l'image
        alveoleImg.src = alveoleUrl;
      });
    } catch (err) {
      console.error('loadAndDrawAlveoles - Erreur:', err);
      return false;
    }
  };

  const renderPreview = async (svgContent: string, svgShapes: SVGShape[], selectedNfts: (NFTMetadata | undefined)[]) => {
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

    // Utiliser d'abord le token ID sélectionné dans la liste déroulante s'il existe
    let tokenId = selectedTokenId || '1'; // Utiliser le token ID sélectionné ou la valeur par défaut
    
    console.log(`renderPreview - Token ID utilisé: ${tokenId}`);
    
    // Si aucun token ID n'est sélectionné, essayer de le détecter à partir du SVG
    if (!selectedTokenId) {
      try {
        // Essayer d'extraire le token ID du contenu SVG
        const svgMatch = svgContent.match(/mask_(\d+)\.svg/);
        if (svgMatch && svgMatch[1]) {
          tokenId = svgMatch[1];
          console.log(`Token ID extrait du contenu SVG: ${tokenId}`);
        }
      } catch (err) {
        console.error('Erreur lors de l\'extraction du token ID du SVG:', err);
      }
    }
    
    // Charger l'image d'alvéoles
    const loaded = await loadAndDrawAlveoles(tokenId, canvas, viewBox, scale);
    if (!loaded) {
      console.error('Erreur lors du chargement de l\'image d\'alvéoles');
      return;
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
                    await applyMaskToImage(nftImage, shape, tempCanvas, true);
                    
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

  // Mettre à jour l'aperçu lorsque les NFTs sélectionnés changent
  useEffect(() => {
    if (svgPreview && shapes.length > 0 && selectedNfts) {
      console.log('Mise à jour de l\'aperçu SVG avec les nouveaux NFTs:', selectedNfts);
      console.log('Token ID actuel:', selectedTokenId);
      
      // Utiliser les formes et le contenu SVG actuels pour le rendu
      renderPreview(svgPreview, shapes, selectedNfts).catch(err => {
        console.error('Error updating preview:', err);
      });
    }
  }, [svgPreview, shapes, selectedNfts, selectedTokenId]); // Ajouter selectedTokenId comme dépendance

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
  const loadSVGFromPublic = async (tokenId: string): Promise<SVGShape[] | null> => {
    try {
      console.log(`===== DÉBUT DU CHARGEMENT DU SVG POUR TOKEN ID: ${tokenId} =====`);
      setVerificationStatus(`Chargement du SVG pour le token ID: ${tokenId}...`);
      setError('');
      
      // Mettre à jour le token ID sélectionné immédiatement
      setSelectedTokenId(tokenId);
      
      // Utiliser l'URL complète avec le chemin de base de l'application
      const baseUrl = window.location.origin;
      const svgPath = `${baseUrl}/svg/mask_${tokenId}.svg`;
      console.log(`Tentative de chargement du SVG depuis: ${svgPath}`);
      
      // Vérifier si le fichier SVG existe dans le dossier public
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
        onSVGLoad(extractedShapes, svgPath);
        setSvgPreview(svgContent);
        
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
      setError("Veuillez connecter votre wallet pour vérifier la propriété");
      setVerificationStatus("Wallet non connecté");
      return;
    }

    try {
      setError('');
      setCheckingNFT(true);
      setVerificationStatus("Vérification en cours...");
      
      console.log("=== DÉBUT DE LA VÉRIFICATION COVER FLEX ===");
      console.log("Adresse du wallet:", walletAddress);
      console.log("État initial - isOwner:", isOwner, "tokenIds:", tokenIds);

      // Vérifier la propriété et récupérer les résultats directement
      const result = await checkOwnership(walletAddress);
      
      console.log("Résultats de checkOwnership:", result);
      console.log("État après checkOwnership - isOwner:", isOwner, "tokenIds:", tokenIds);
      
      // Utiliser les résultats retournés directement par le hook
      if (result.isOwner && result.tokenIds.length > 0) {
        console.log(`Cover Flex trouvé! Token IDs: ${result.tokenIds.join(', ')}`);
        
        // Prendre le premier token ID trouvé et le définir comme sélectionné
        const tokenId = result.tokenIds[0];
        setSelectedTokenId(tokenId);
        console.log("Token ID sélectionné pour chargement:", tokenId);
        
        // Mettre à jour le statut avec le nombre de Cover Flex trouvés
        if (result.tokenIds.length === 1) {
          setVerificationStatus(`Cover Flex trouvé! Token ID: ${tokenId}`);
        } else {
          setVerificationStatus(`${result.tokenIds.length} Cover Flex trouvés! Token IDs: ${result.tokenIds.join(', ')}`);
          setShowTokenSelector(true);
        }
        
        // Charger directement le SVG correspondant
        await loadSVGFromPublic(tokenId);
      } else {
        console.log(`Aucun Cover Flex trouvé pour l'adresse ${walletAddress}`);
        setError("Aucun Cover Flex trouvé pour cette adresse wallet");
        setVerificationStatus("Aucun Cover Flex trouvé");
      }
      
      console.log("=== FIN DE LA VÉRIFICATION COVER FLEX ===");
    } catch (err) {
      console.error("Erreur lors de la vérification de la propriété d'un Cover Flex:", err);
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
          <h3 className="text-lg font-medium mb-2">Vérification de la propriété d'un Cover Flex</h3>
          <p className="text-sm text-gray-600 mb-3">
            Connectez votre wallet et vérifiez si vous possédez un Cover Flex de la collection pour charger automatiquement votre SVG.
          </p>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCheckNFT}
              disabled={!walletAddress || checkingNFT}
              className={`px-4 py-2 rounded-md ${!walletAddress || checkingNFT ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              {checkingNFT ? 'Vérification...' : 'Vérifier propriété'}
            </button>
            
            {verificationStatus && !showTokenSelector && (
              <span className={`text-sm ${error ? 'text-red-500' : 'text-green-600'}`}>
                {verificationStatus}
              </span>
            )}
          </div>
          
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
          
          {/* Liste déroulante pour sélectionner un NFT spécifique du contrat */}
          {showTokenSelector && tokenIds.length > 1 && (
            <div className="mt-4">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center">
                  <span className="text-sm text-green-600 mr-2">
                    {`${tokenIds.length} Cover Flex trouvés dans votre wallet`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    id="token-selector"
                    value={selectedTokenId || ''}
                    onChange={(e) => {
                      const newTokenId = e.target.value;
                      console.log(`Changement de token ID: ${newTokenId}`);
                      
                      // Réinitialiser le canvas avant de charger le nouveau SVG
                      if (previewCanvasRef.current) {
                        const ctx = previewCanvasRef.current.getContext('2d');
                        if (ctx) {
                          ctx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
                        }
                      }
                      
                      // Réinitialiser les NFTs positionnés dans les zones
                      // Utiliser onCellDrop pour vider chaque cellule
                      if (onCellDrop) {
                        shapes.forEach((_, index) => {
                          onCellDrop(index, undefined);
                        });
                      }
                      
                      // Mettre à jour le token ID sélectionné
                      setSelectedTokenId(newTokenId);
                      
                      // Signaler le changement de token ID au composant parent
                      if (onTokenIdChange) {
                        onTokenIdChange(newTokenId);
                      }
                      
                      // Forcer un petit délai pour s'assurer que l'état est mis à jour
                      setTimeout(async () => {
                        // Charger le nouveau SVG
                        if (newTokenId && previewCanvasRef.current) {
                          // Charger le SVG
                          const shapes = await loadSVGFromPublic(newTokenId);
                          
                          // Si le chargement du SVG a réussi et que nous avons des formes
                          if (shapes && shapes.length > 0 && previewCanvasRef.current) {
                            // Calculer l'échelle pour l'affichage
                            const viewBox = shapes[0].viewBox;
                            const maxPreviewSize = 300;
                            const scale = Math.min(
                              maxPreviewSize / viewBox.width,
                              maxPreviewSize / viewBox.height
                            );
                            
                            // Forcer le chargement et l'affichage de l'image d'alvéoles
                            await loadAndDrawAlveoles(newTokenId, previewCanvasRef.current, viewBox, scale);
                          }
                        }
                      }, 50);
                    }}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    style={{ padding: '0.5rem', border: '1px solid #d1d5db' }}
                  >
                    {tokenIds.map((id) => (
                      <option key={id} value={id}>
                        Cover Flex #{id} - Base Sepolia
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-sm text-gray-600">
                  <span>
                    {selectedTokenId ? `SVG chargé avec succès pour le token ID: ${selectedTokenId}` : 'Sélectionnez un Cover Flex'}
                  </span>
                </div>
              </div>
            </div>
          )}
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
      </div>
    </div>
  );
};