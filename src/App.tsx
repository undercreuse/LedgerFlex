import React, { useState } from 'react';
import { Web3Connect } from './components/Web3Connect';
import { SVGUploader } from './components/SVGUploader';
import { NFTSelector } from './components/NFTSelector';
import { SVGShape, NFTMetadata } from './types';
import { applyMaskToImage } from './utils/svgProcessor';
import { Download } from 'lucide-react';

function App() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState<string | undefined>(undefined);
  const [shapes, setShapes] = useState<SVGShape[]>([]);
  const [nfts, setNfts] = useState<(NFTMetadata | undefined)[]>([]);
  const [maskedImages, setMaskedImages] = useState<HTMLCanvasElement[]>([]);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [svgUrl, setSvgUrl] = useState<string>(''); 
  const [showFinalResult, setShowFinalResult] = useState(true);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const handleConnect = (walletAddress: string, selectedChainId?: string) => {
    if (!walletAddress) {
      setConnected(false);
      setAddress('');
      setChainId(undefined);
      return;
    }
    
    setConnected(true);
    setAddress(walletAddress);
    setChainId(selectedChainId);
  };

  const handleSVGLoad = (loadedShapes: SVGShape[], url: string) => {
    setShapes(loadedShapes);
    setNfts([]);
    setMaskedImages([]);
    setFinalImage(null);
    setError(null);
    setSvgUrl(url);
  };

  const handleCellDrop = (cellIndex: number, nft: NFTMetadata | undefined) => {
    if (processing) return;
    
    try {
      setError(null);
      setProcessing(true);
      
      const updatedNfts = [...nfts];
      
      if (nft === undefined) {
        updatedNfts[cellIndex] = undefined;
        console.log(`NFT supprimé de la cellule ${cellIndex + 1}`);
      } else {
        updatedNfts[cellIndex] = nft;
        console.log(`NFT ${nft.name} placé dans la cellule ${cellIndex + 1}`);
      }
      
      // Mettre à jour l'état des NFTs
      setNfts(updatedNfts);
      
      // Réinitialiser l'image finale car elle n'est plus à jour
      setFinalImage(null);
      
      // Traiter immédiatement les images masquées avec les NFTs mis à jour
      // Utiliser directement updatedNfts au lieu de filtrer selectedNfts
      processNFTImages(updatedNfts);
    } catch (err) {
      console.error('Erreur lors du traitement du drop:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du traitement du drop');
      setProcessing(false);
    }
  };

  const mergeMaskedImages = async (
    images: HTMLCanvasElement[],
    finalCanvas: HTMLCanvasElement,
    viewBox: SVGShape['viewBox']
  ): Promise<string> => {
    finalCanvas.width = viewBox.width;
    finalCanvas.height = viewBox.height;

    const ctx = finalCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    ctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
    
    // Ajouter un fond blanc
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    let tokenId = '1'; 
    try {
      // Extraire le token ID du SVG s'il est disponible
      if (svgUrl) {
        try {
          const svgResponse = await fetch(svgUrl);
          const svgContent = await svgResponse.text();
          console.log("SVG Content pour détection du token ID (rendu final):", svgContent.substring(0, 200));
          
          const svgMatch = svgContent.match(/mask_(\d+)\.svg/);
          if (svgMatch && svgMatch[1]) {
            tokenId = svgMatch[1];
            console.log(`Token ID détecté depuis le SVG pour le rendu final: ${tokenId}`);
          }
        } catch (err) {
          console.warn('Erreur lors de l\'extraction du token ID depuis le SVG:', err);
        }
      }
      
      // Si le token ID n'est pas dans le SVG, essayer de l'extraire de l'URL
      if (tokenId === '1') {
        const urlMatch = window.location.href.match(/token[Ii]d=(\d+)/);
        if (urlMatch && urlMatch[1]) {
          tokenId = urlMatch[1];
          console.log(`Token ID détecté depuis l'URL pour le rendu final: ${tokenId}`);
        } else {
          console.warn("Impossible de détecter le token ID pour le rendu final, utilisation de la valeur par défaut: 1");
        }
      }
    } catch (err) {
      console.warn('Impossible de détecter le token ID pour le rendu final:', err);
    }

    // Forcer le token ID à être une chaîne de caractères
    tokenId = String(tokenId);
    console.log(`Token ID final pour le rendu final: ${tokenId}`);

    // Définir explicitement l'URL de l'image d'alvéoles
    const baseUrl = window.location.origin;
    const alveoleUrl = `${baseUrl}/svg/alveoles_${tokenId}.png?t=${Date.now()}`;
    console.log(`URL de l'image d'alvéoles à charger pour le rendu final: ${alveoleUrl}`);

    try {
      await new Promise<void>((resolve) => {
        const alveoleImg = new Image();
        alveoleImg.crossOrigin = 'anonymous';
        
        const timeoutId = setTimeout(() => {
          console.warn(`Timeout lors du chargement de l'image d'alvéoles pour le rendu final`);
          resolve(); 
        }, 5000);
        
        alveoleImg.onload = () => {
          clearTimeout(timeoutId);
          console.log(`Image d'alvéoles chargée avec succès pour le rendu final: alveoles_${tokenId}.png`);
          ctx.drawImage(alveoleImg, 0, 0, finalCanvas.width, finalCanvas.height);
          resolve();
        };
        
        alveoleImg.onerror = () => {
          clearTimeout(timeoutId);
          console.error(`Erreur lors du chargement de l'image d'alvéoles pour le rendu final: alveoles_${tokenId}.png`);
          resolve(); 
        };
        
        alveoleImg.src = alveoleUrl;
      });
    } catch (err) {
      console.error('Erreur lors du chargement de l\'image d\'alvéoles pour le rendu final:', err);
    }

    for (const canvas of images) {
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Invalid masked image dimensions');
      }
      ctx.drawImage(canvas, 0, 0);
    }

    const dataUrl = finalCanvas.toDataURL('image/png');
    return dataUrl;
  };

  const processNFTImages = async (updatedNfts: (NFTMetadata | undefined)[]) => {
    try {
      setMaskedImages([]);
      
      const newMaskedImages: HTMLCanvasElement[] = [];

      for (let cellIndex = 0; cellIndex < shapes.length; cellIndex++) {
        const currentNft = updatedNfts[cellIndex];
        const currentShape = shapes[cellIndex];
        
        if (!currentNft || !currentShape) {
          continue;
        }

        const image = new Image();
        image.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout loading image ${cellIndex + 1}`));
          }, 30000);

          image.onload = async () => {
            clearTimeout(timeoutId);
            try {
              if (image.width === 0 || image.height === 0) {
                throw new Error('Invalid image dimensions');
              }

              const maskedCanvas = document.createElement('canvas');
              maskedCanvas.width = currentShape.viewBox.width;
              maskedCanvas.height = currentShape.viewBox.height;

              await applyMaskToImage(image, currentShape, maskedCanvas);

              const maskedCtx = maskedCanvas.getContext('2d');
              if (!maskedCtx) throw new Error('Could not get masked canvas context');

              const imageData = maskedCtx.getImageData(
                0, 0, maskedCanvas.width, maskedCanvas.height
              );
              if (!imageData.data.some(pixel => pixel !== 0)) {
                throw new Error('Masked image is empty');
              }

              newMaskedImages[cellIndex] = maskedCanvas;

              resolve();
            } catch (err) {
              reject(err);
            }
          };

          image.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error(`Failed to load image ${cellIndex + 1} from URL: ${currentNft.imageUrl}`));
          };

          const maxRetries = 3;
          let retryCount = 0;

          const loadImage = () => {
            const cacheBuster = `?t=${Date.now()}`;
            image.src = currentNft.imageUrl + cacheBuster;
          };

          image.onerror = () => {
            clearTimeout(timeoutId);
            if (retryCount < maxRetries) {
              retryCount++;
              setTimeout(loadImage, 1000 * retryCount); 
            } else {
              reject(new Error(`Failed to load image after ${maxRetries} attempts: ${currentNft.imageUrl}`));
            }
          };

          loadImage();
        });
      }

      const filteredMaskedImages = newMaskedImages.filter(Boolean);
      
      setMaskedImages(filteredMaskedImages);
      
      console.log(`${filteredMaskedImages.length} images masquées créées`);

      if (filteredMaskedImages.length > 0) {
        const finalCanvas = canvasRef.current;
        if (!finalCanvas) throw new Error('Canvas not available');

        const dataUrl = await mergeMaskedImages(
          filteredMaskedImages,
          finalCanvas,
          shapes[0].viewBox
        );

        setFinalImage(dataUrl);
      }
    } catch (err) {
      console.error('Error processing image:', err);
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!finalImage && !svgUrl) return;
    
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const formattedTime = `${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;
    
    if (finalImage) {
      const link = document.createElement('a');
      link.href = finalImage;
      link.download = `ledgerstax_${formattedDate}_${formattedTime}.png`;
      link.click();
      return;
    }
    
    if (svgUrl && shapes.length > 0) {
      try {
        let tokenId = '1'; 
        
        // Charger le contenu SVG
        const svgResponse = await fetch(svgUrl);
        const svgContent = await svgResponse.text();
        console.log("SVG Content pour détection du token ID (téléchargement):", svgContent.substring(0, 200));
        
        // Essayer d'extraire le token ID du contenu SVG
        const svgMatch = svgContent.match(/mask_(\d+)\.svg/);
        if (svgMatch && svgMatch[1]) {
          tokenId = svgMatch[1];
          console.log(`Token ID détecté depuis le SVG pour le téléchargement: ${tokenId}`);
        } 
        // Sinon, rechercher dans l'URL si disponible
        else {
          const urlMatch = window.location.href.match(/token[Ii]d=(\d+)/);
          if (urlMatch && urlMatch[1]) {
            tokenId = urlMatch[1];
            console.log(`Token ID détecté depuis l'URL pour le téléchargement: ${tokenId}`);
          } else {
            console.warn("Impossible de détecter le token ID pour le téléchargement, utilisation de la valeur par défaut: 1");
          }
        }
        
        // Forcer le token ID à être une chaîne de caractères
        tokenId = String(tokenId);
        console.log(`Token ID final pour le téléchargement: ${tokenId}`);
        
        const canvas = document.createElement('canvas');
        const viewBox = shapes[0].viewBox;
        canvas.width = viewBox.width;
        canvas.height = viewBox.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error("Impossible de créer le contexte 2D");
        }
        
        // Ajouter un fond blanc
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Définir explicitement l'URL de l'image d'alvéoles
        const baseUrl = window.location.origin;
        const alveoleUrl = `${baseUrl}/svg/alveoles_${tokenId}.png?t=${Date.now()}`;
        console.log(`URL de l'image d'alvéoles à charger pour le téléchargement: ${alveoleUrl}`);
        
        const alveoleImg = new Image();
        alveoleImg.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          alveoleImg.onload = () => {
            console.log(`Image d'alvéoles chargée avec succès pour le téléchargement: alveoles_${tokenId}.png`);
            ctx.drawImage(alveoleImg, 0, 0, canvas.width, canvas.height);
            
            const svgImg = new Image();
            svgImg.crossOrigin = 'anonymous';
            svgImg.onload = () => {
              ctx.drawImage(svgImg, 0, 0, canvas.width, canvas.height);
              
              const imageUrl = canvas.toDataURL('image/png');
              const link = document.createElement('a');
              link.href = imageUrl;
              link.download = `ledgerstax_${tokenId}_${formattedDate}_${formattedTime}.png`;
              link.click();
              resolve();
            };
            svgImg.onerror = () => reject(new Error("Impossible de charger l'image SVG"));
            svgImg.src = svgUrl;
          };
          alveoleImg.onerror = () => {
            console.warn(`Impossible de charger l'image d'alvéoles ${tokenId}, utilisation du SVG uniquement`);
            
            // Ajouter un fond blanc (à nouveau au cas où l'image d'alvéoles n'a pas pu être chargée)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const svgImg = new Image();
            svgImg.crossOrigin = 'anonymous';
            svgImg.onload = () => {
              ctx.drawImage(svgImg, 0, 0, canvas.width, canvas.height);
              
              const imageUrl = canvas.toDataURL('image/png');
              const link = document.createElement('a');
              link.href = imageUrl;
              link.download = `ledgerstax_${tokenId}_${formattedDate}_${formattedTime}.png`;
              link.click();
              resolve();
            };
            svgImg.onerror = () => reject(new Error("Impossible de charger l'image SVG"));
            svgImg.src = svgUrl;
          };
          
          alveoleImg.src = alveoleUrl;
        });
      } catch (err) {
        console.error("Erreur lors du téléchargement de l'image:", err);
        setError(`Erreur lors du téléchargement: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header avec Web3Connect */}
      <Web3Connect onConnect={handleConnect} />
      
      <main className="flex-1">
        {!connected ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Bienvenue sur LedgerStax</h2>
              <p className="text-gray-600 mb-4">
                Connectez votre wallet pour commencer à utiliser l'application.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-[calc(100vh-80px)] overflow-hidden">
            {/* Colonne de gauche */}
            <div className="w-1/3 p-6 overflow-y-auto border-r border-gray-200 bg-white">
              <div className="space-y-6">
                <SVGUploader 
                  onSVGLoad={handleSVGLoad}
                  selectedNfts={nfts}
                  walletAddress={address}
                  onCellDrop={handleCellDrop}
                />
                
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}
                
                {maskedImages.length > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                      {maskedImages.length} images masquées créées
                    </p>
                  </div>
                )}
                
                {(finalImage || svgUrl) && (
                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Résultat final</h3>
                      <button
                        onClick={() => setShowFinalResult(!showFinalResult)}
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                      >
                        {showFinalResult ? 'Masquer' : 'Afficher'}
                      </button>
                    </div>
                    
                    <div className={`relative bg-gray-100 rounded-lg overflow-hidden ${showFinalResult ? '' : 'hidden'}`}>
                      <canvas ref={canvasRef} className="w-full" style={{ display: 'none' }} />
                      
                      {finalImage ? (
                        <img 
                          src={finalImage} 
                          alt="Composition NFT traitée" 
                          className="w-full h-auto"
                        />
                      ) : (
                        <div className="h-64 flex items-center justify-center">
                          <p className="text-gray-500">
                            {processing ? 'Traitement en cours...' : 'Aucune image générée pour le moment'}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={handleDownloadImage}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center"
                        disabled={!finalImage}
                      >
                        <Download className="w-5 h-5 mr-2" />
                        Télécharger l'image
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Colonne de droite */}
            <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
              <div className="space-y-6">
                {connected && (
                  <div className="mb-8">
                    <NFTSelector 
                      walletAddress={address} 
                      requiredCount={shapes.length} 
                      isProcessing={processing}
                      chainId={chainId}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Canvas caché pour le traitement */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </main>
    </div>
  );
}

export default App;