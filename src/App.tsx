import React, { useState } from 'react';
import { Web3Connect } from './components/Web3Connect';
import { SVGUploader } from './components/SVGUploader';
import { NFTSelector } from './components/NFTSelector';
import { SVGShape, NFTMetadata } from './types';
import { applyMaskToImage, extractShapesFromSVG } from './utils/svgProcessor';
import { useNetworks } from './hooks/useNetworks';

function App() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [chainId, setChainId] = useState<string | undefined>(undefined);
  const [nfts, setNfts] = useState<(NFTMetadata | undefined)[]>([]);
  const [shapes, setShapes] = useState<SVGShape[]>([]);
  const [maskedImages, setMaskedImages] = useState<HTMLCanvasElement[]>([]);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string>('1');
  const [brightness, setBrightness] = useState<number>(100); // Valeur par défaut: 100%
  // Toujours en mode niveaux de gris
  const grayscaleMode = true;
  
  // Utilisation du hook useNetworks pour récupérer les réseaux disponibles
  const { networks, selectedNetwork, setSelectedNetwork } = useNetworks();
  
  // URL de l'image des alvéoles basée sur le token ID sélectionné
  const alveolesImageUrl = selectedTokenId ? `/svg/alveoles_${selectedTokenId}.png` : null;

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

  // Gestionnaire pour le changement de réseau
  const handleNetworkChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const networkId = event.target.value;
    const network = networks.find(n => n.id === networkId);
    if (network) {
      setSelectedNetwork(network);
      // Mettre à jour le chainId pour recharger les NFTs
      setChainId(network.chainId);
      // Ne pas réinitialiser les NFTs déjà ajoutés et l'aperçu
      setError(null);
    }
  };

  const handleSVGLoad = (loadedShapes: SVGShape[], url: string) => {
    setShapes(loadedShapes);
    setSvgUrl(url);
    setError(null);
    
    // Conserver les NFTs déjà ajoutés
    if (nfts.length > 0) {
      // Traiter les NFTs existants avec le nouveau SVG
      processNFTImages(nfts);
    }
  };

  const handleTokenIdChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newTokenId = event.target.value;
    console.log(`Token ID sélectionné: ${newTokenId}`);
    setSelectedTokenId(newTokenId);
    
    setError(null);
    
    try {
      // Charger le SVG correspondant au token ID sélectionné
      const baseUrl = window.location.origin;
      const svgUrl = `${baseUrl}/svg/mask_${newTokenId}.svg?t=${Date.now()}`;
      
      console.log(`Chargement du SVG pour le token ID ${newTokenId}: ${svgUrl}`);
      
      const response = await fetch(svgUrl);
      if (!response.ok) {
        throw new Error(`Impossible de charger le SVG pour le token ID ${newTokenId}`);
      }
      
      const svgContent = await response.text();
      
      // Extraire les formes du SVG
      const loadedShapes = extractShapesFromSVG(svgContent);
      
      // Mettre à jour l'état avec les nouvelles formes et l'URL du SVG
      setShapes(loadedShapes);
      setSvgUrl(svgUrl);
      
      // Conserver les NFTs déjà ajoutés
      if (nfts.length > 0) {
        // Traiter les NFTs existants avec le nouveau SVG
        processNFTImages(nfts);
      }
    } catch (error) {
      console.error(`Erreur lors du chargement du SVG pour le token ID ${newTokenId}:`, error);
      setError(`Erreur lors du chargement du SVG: ${error instanceof Error ? error.message : String(error)}`);
    }
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
    
    // Utiliser directement le token ID sélectionné s'il est disponible
    let tokenId = selectedTokenId || '1';
    
    // Si le token ID n'est pas défini, essayer de l'extraire du SVG
    if (!tokenId || tokenId === '') {
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
    } else {
      console.log(`Utilisation du token ID sélectionné pour le rendu final: ${tokenId}`);
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

              await applyMaskToImage(image, currentShape, maskedCanvas, grayscaleMode);

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
    if (!finalImage && !alveolesImageUrl) return;
    
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const formattedTime = `${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;
    
    if (finalImage) {
      try {
        // Appliquer la luminosité à l'image finale
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error("Impossible de créer le contexte 2D"));
              return;
            }
            
            // Dessiner l'image sur le canvas
            ctx.drawImage(img, 0, 0);
            
            // Appliquer la luminosité
            if (brightness !== 100) {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imageData.data;
              
              for (let i = 0; i < data.length; i += 4) {
                // Appliquer la luminosité à chaque pixel (R, G, B)
                data[i] = Math.min(255, Math.max(0, data[i] * brightness / 100));
                data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * brightness / 100));
                data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * brightness / 100));
                // Ne pas modifier l'alpha (i + 3)
              }
              
              ctx.putImageData(imageData, 0, 0);
            }
            
            // Télécharger l'image
            const imageUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = `ledgerstax_${formattedDate}_${formattedTime}.png`;
            link.click();
            
            resolve();
          };
          
          img.onerror = () => {
            reject(new Error("Impossible de charger l'image finale"));
          };
          
          img.src = finalImage;
        });
      } catch (err) {
        console.error('Erreur lors du téléchargement de l\'image finale:', err);
        setError(err instanceof Error ? err.message : 'Échec du téléchargement de l\'image finale');
        
        // Fallback au téléchargement direct si l'application de la luminosité échoue
        const link = document.createElement('a');
        link.href = finalImage;
        link.download = `ledgerstax_${formattedDate}_${formattedTime}.png`;
        link.click();
      }
      
      return;
    }
    
    if (alveolesImageUrl) {
      try {
        // Téléchargement de l'image des alvéoles avec un fond blanc et luminosité ajustée
        const response = await fetch(alveolesImageUrl);
        const blob = await response.blob();
        
        // Créer une image à partir du blob
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            // Créer un canvas pour ajouter un fond blanc
            const canvas = document.createElement('canvas');
            
            // Définir les dimensions du canvas
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error("Impossible de créer le contexte 2D"));
              return;
            }
            
            // Ajouter un fond blanc
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Dessiner l'image des alvéoles sur le fond blanc
            ctx.drawImage(img, 0, 0);
            
            // Appliquer la luminosité
            if (brightness !== 100) {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imageData.data;
              
              for (let i = 0; i < data.length; i += 4) {
                // Appliquer la luminosité à chaque pixel (R, G, B)
                data[i] = Math.min(255, Math.max(0, data[i] * brightness / 100));
                data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * brightness / 100));
                data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * brightness / 100));
                // Ne pas modifier l'alpha (i + 3)
              }
              
              ctx.putImageData(imageData, 0, 0);
            }
            
            // Convertir le canvas en URL de données
            const imageUrl = canvas.toDataURL('image/png');
            
            // Télécharger l'image
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = `alveoles_${selectedTokenId}_${formattedDate}_${formattedTime}.png`;
            link.click();
            
            resolve();
          };
          
          img.onerror = () => {
            reject(new Error("Impossible de charger l'image des alvéoles"));
          };
          
          img.src = URL.createObjectURL(blob);
        });
        
        return;
      } catch (err) {
        console.error('Erreur lors du téléchargement de l\'image des alvéoles:', err);
        setError(err instanceof Error ? err.message : 'Échec du téléchargement de l\'image des alvéoles');
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
                  selectedTokenId={selectedTokenId}
                  onTokenIdChange={handleTokenIdChange}
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
                    </div>
                    
                    <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                      <canvas ref={canvasRef} className="w-full" style={{ display: 'none' }} />
                      
                      {finalImage ? (
                        <div>
                          <img 
                            src={finalImage} 
                            alt="Composition NFT traitée" 
                            className="w-full h-auto"
                            style={{ filter: `brightness(${brightness}%)` }}
                          />
                        </div>
                      ) : alveolesImageUrl ? (
                        <div>
                          <img 
                            src={alveolesImageUrl} 
                            alt="Alvéoles" 
                            className="w-full h-auto"
                            style={{ filter: `brightness(${brightness}%)` }}
                          />
                        </div>
                      ) : (
                        <div className="h-64 flex items-center justify-center">
                          <p className="text-gray-500">
                            {processing ? 'Traitement en cours...' : 'Aucune image générée pour le moment'}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Curseur de luminosité */}
                    {(finalImage || alveolesImageUrl) && (
                      <div className="mt-4">
                        <label htmlFor="brightness-slider" className="block text-sm font-medium text-gray-700 mb-1">
                          Luminosité: {brightness}%
                        </label>
                        <input
                          id="brightness-slider"
                          type="range"
                          min="50"
                          max="150"
                          value={brightness}
                          onChange={(e) => setBrightness(Number(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}
                    
                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={handleDownloadImage}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center"
                        disabled={!finalImage && !alveolesImageUrl}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
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
                {/* Sélecteur de réseau */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold mb-4">Sélectionner un réseau</h3>
                  <div className="relative">
                    <select
                      className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedNetwork?.id || ''}
                      onChange={handleNetworkChange}
                    >
                      {networks.map((network) => (
                        <option key={network.id} value={network.id}>
                          {network.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {connected && (
                  <div className="mb-8">
                    <NFTSelector 
                      requiredCount={shapes.length} 
                      walletAddress={address}
                      isProcessing={processing}
                      chainId={chainId}
                      selectedNetwork={selectedNetwork}
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