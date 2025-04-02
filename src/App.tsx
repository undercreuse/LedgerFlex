import { useState, useEffect, useRef } from 'react';
import { Web3Connect } from './components/Web3Connect';
import { SVGUploader } from './components/SVGUploader';
import { NFTSelector } from './components/NFTSelector';
import { SVGShape, NFTMetadata } from './types';
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
  const [currentTokenId, setCurrentTokenId] = useState<string>('1'); // Nouvel état pour stocker le token ID actuel
  const [alveolesImage, setAlveolesImage] = useState<string | null>(null); // Nouvel état pour stocker l'URL de l'image des alvéoles
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    
    // Extraire le token ID de l'URL du SVG
    const tokenIdMatch = url.match(/mask_(\d+)\.svg/);
    if (tokenIdMatch && tokenIdMatch[1]) {
      const tokenId = tokenIdMatch[1];
      setCurrentTokenId(tokenId);
      
      // Initialiser l'image des alvéoles
      const baseUrl = window.location.origin;
      const timestamp = Date.now();
      const alveoleUrl = `${baseUrl}/svg/alveoles_${tokenId}.png?t=${timestamp}`;
      setAlveolesImage(alveoleUrl);
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
    maskedImages: string[],
    canvas: HTMLCanvasElement,
    viewBox: SVGShape['viewBox'] | string
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        let width: number;
        let height: number;

        // Gérer les deux types de viewBox possibles
        if (typeof viewBox === 'string') {
          // Si viewBox est une chaîne, extraire les dimensions
          const [, , w, h] = viewBox.split(' ').map(Number);
          width = w;
          height = h;
        } else {
          // Si viewBox est un objet, utiliser directement les propriétés
          width = viewBox.width;
          height = viewBox.height;
        }
        
        // Définir les dimensions du canvas
        canvas.width = width;
        canvas.height = height;
        
        // Ajouter un fond blanc
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Si aucune image masquée, retourner simplement le canvas avec le fond blanc
        if (maskedImages.length === 0) {
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
          return;
        }

        // Fonction pour charger une image de manière séquentielle
        const loadImageSequentially = (index: number) => {
          if (index >= maskedImages.length) {
            // Toutes les images ont été chargées, on peut résoudre la promesse
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
            return;
          }

          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          img.onload = () => {
            ctx.drawImage(img, 0, 0, width, height);
            // Passer à l'image suivante
            loadImageSequentially(index + 1);
          };
          
          img.onerror = (e) => {
            console.error(`Error loading image:`, e);
            // Même en cas d'erreur, on passe à l'image suivante
            loadImageSequentially(index + 1);
          };
          
          img.src = maskedImages[index];
        };

        // Commencer le chargement séquentiel des images
        loadImageSequentially(0);
      } catch (error) {
        reject(error);
      }
    });
  };

  const applyMaskToNFTImage = async (
    nft: NFTMetadata,
    shape: SVGShape,
    canvas: HTMLCanvasElement
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Charger l'image du NFT
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          // Effacer le canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Calculer l'échelle pour adapter l'image aux dimensions du masque tout en conservant les proportions
          const scaleX = shape.bounds.width / img.width;
          const scaleY = shape.bounds.height / img.height;
          const scale = Math.max(scaleX, scaleY);
          
          // Calculer la position pour centrer l'image dans le masque
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const x = shape.center.x - scaledWidth / 2;
          const y = shape.center.y - scaledHeight / 2;
          
          // Sauvegarder l'état du contexte
          ctx.save();
          
          // Appliquer la transformation du viewBox
          ctx.translate(-shape.viewBox.minX, -shape.viewBox.minY);
          
          // Créer un chemin pour le masque
          const path = new Path2D(shape.path);
          
          // Appliquer le masque
          ctx.clip(path);
          
          // Dessiner l'image
          ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
          
          // Restaurer l'état du contexte
          ctx.restore();
          
          resolve();
        };
        
        img.onerror = () => {
          console.error(`Failed to load image for NFT: ${nft.imageUrl}`);
          reject(new Error(`Failed to load image for NFT: ${nft.imageUrl}`));
        };
        
        img.src = nft.imageUrl;
      } catch (error) {
        reject(error);
      }
    });
  };

  const processNFTImages = async (selectedNfts: (NFTMetadata | undefined)[]) => {
    if (processing) return;
    if (!shapes.length) return;
    
    try {
      setError(null);
      setProcessing(true);
      
      // Vérifier si au moins un NFT est sélectionné
      const hasSelectedNfts = selectedNfts.some(nft => nft !== undefined);
      
      if (!hasSelectedNfts) {
        console.log("Aucun NFT sélectionné, génération directe de l'image d'alvéoles");
        
        const finalCanvas = canvasRef.current;
        if (!finalCanvas) throw new Error('Canvas not available');
        
        // Charger l'image des alvéoles
        if (currentTokenId) {
          const baseUrl = window.location.origin;
          const timestamp = Date.now();
          const alveoleUrl = `${baseUrl}/svg/alveoles_${currentTokenId}.png?t=${timestamp}`;
          setAlveolesImage(alveoleUrl);
          
          // Utiliser la fonction mergeMaskedImages mais sans images masquées
          const dataUrl = await mergeMaskedImages(
            [alveoleUrl], // Inclure l'image des alvéoles
            finalCanvas,
            shapes[0].viewBox
          );
          
          setFinalImage(dataUrl);
        }
        
        setProcessing(false);
        return;
      }
      
      // Si des NFTs sont sélectionnés, continuer avec le traitement normal
      const filteredNfts = selectedNfts.filter(Boolean) as NFTMetadata[];
      console.log(`Traitement de ${filteredNfts.length} NFTs`);
      
      // Créer un canvas pour chaque NFT
      const newMaskedImages: HTMLCanvasElement[] = [];
      
      for (let i = 0; i < shapes.length; i++) {
        const shape = shapes[i];
        const nft = selectedNfts[i];
        
        if (!nft) {
          newMaskedImages.push(document.createElement('canvas'));
          continue;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = shape.viewBox.width;
        canvas.height = shape.viewBox.height;
        
        await applyMaskToNFTImage(nft, shape, canvas);
        
        newMaskedImages.push(canvas);
      }
      
      const filteredMaskedImages = newMaskedImages.filter(Boolean);
      
      setMaskedImages(filteredMaskedImages);
      
      console.log(`${filteredMaskedImages.length} images masquées créées`);

      if (filteredMaskedImages.length > 0) {
        const finalCanvas = canvasRef.current;
        if (!finalCanvas) throw new Error('Canvas not available');

        // Préparer les images à fusionner
        const imagesToMerge: string[] = [];
        
        // Ajouter d'abord l'image des alvéoles si elle existe
        // Cela permettra aux NFTs d'être au-dessus des alvéoles dans le rendu final
        // car la fonction mergeMaskedImages dessine les images dans l'ordre du tableau
        if (currentTokenId) {
          const baseUrl = window.location.origin;
          const timestamp = Date.now();
          const alveoleUrl = `${baseUrl}/svg/alveoles_${currentTokenId}.png?t=${timestamp}`;
          setAlveolesImage(alveoleUrl);
          imagesToMerge.push(alveoleUrl);
        }
        
        // Ajouter ensuite les images masquées des NFTs
        // Elles seront dessinées après les alvéoles et donc apparaîtront au-dessus
        imagesToMerge.push(...filteredMaskedImages.map(canvas => canvas.toDataURL('image/png')));
        
        // Fusionner toutes les images
        const dataUrl = await mergeMaskedImages(
          imagesToMerge,
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
    // Vérifier si nous avons un token ID valide
    if (!currentTokenId) {
      setError("Aucun Cover Flex sélectionné");
      return;
    }
    
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const formattedTime = `${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;
    
    // Si une image finale existe déjà, la télécharger directement
    if (finalImage) {
      const link = document.createElement('a');
      link.href = finalImage;
      link.download = `coverflex_${currentTokenId}_${formattedDate}_${formattedTime}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    
    // Si nous avons l'image des alvéoles, la télécharger directement
    if (alveolesImage) {
      try {
        // Charger l'image des alvéoles dans un nouvel objet Image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error("Timeout lors du chargement de l'image des alvéoles"));
          }, 5000);
          
          img.onload = () => {
            clearTimeout(timeoutId);
            
            // Créer un canvas temporaire pour dessiner l'image avec un fond blanc
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            
            const ctx = tempCanvas.getContext('2d');
            if (!ctx) {
              reject(new Error("Impossible d'obtenir le contexte du canvas"));
              return;
            }
            
            // Ajouter un fond blanc
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Dessiner l'image sur le canvas par-dessus le fond blanc
            ctx.drawImage(img, 0, 0);
            
            // Convertir le canvas en URL de données
            const dataUrl = tempCanvas.toDataURL('image/png');
            
            // Télécharger l'image
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `coverflex_${currentTokenId}_${formattedDate}_${formattedTime}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            resolve();
          };
          
          img.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error(`Erreur lors du chargement de l'image des alvéoles`));
          };
          
          img.src = alveolesImage;
        });
      } catch (err) {
        console.error('Error downloading image with white background:', err);
        setError(err instanceof Error ? err.message : 'Failed to download image');
      }
      return;
    }
    
    // Si nous n'avons pas encore d'image, essayer de la générer
    if (shapes.length > 0) {
      try {
        setProcessing(true);
        
        // Traiter les NFTs pour générer l'image finale
        await processNFTImages(nfts);
        
        // À ce stade, finalImage devrait être défini
        if (finalImage) {
          const link = document.createElement('a');
          link.href = finalImage;
          link.download = `coverflex_${currentTokenId}_${formattedDate}_${formattedTime}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (err) {
        console.error('Error downloading image:', err);
        setError(err instanceof Error ? err.message : 'Failed to download image');
      } finally {
        setProcessing(false);
      }
    }
  };

  const handleTokenIdChange = (tokenId: string) => {
    console.log(`Token ID changé: ${tokenId}`);
    setCurrentTokenId(tokenId);
    
    // Réinitialiser complètement le tableau des NFTs sélectionnés
    setNfts(Array(shapes.length).fill(undefined));
    
    // Réinitialiser l'image finale car elle n'est plus à jour
    setFinalImage(null);
    
    // Réinitialiser les images masquées
    setMaskedImages([]);
    
    // Nettoyer explicitement le canvas du résultat final
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Ajouter un fond blanc pour s'assurer que le canvas est visiblement vide
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    
    // Mettre à jour l'URL de l'image des alvéoles
    const baseUrl = window.location.origin;
    const timestamp = Date.now();
    const alveoleUrl = `${baseUrl}/svg/alveoles_${tokenId}.png?t=${timestamp}`;
    setAlveolesImage(alveoleUrl);
  };

  // Initialiser l'image des alvéoles pour le token ID par défaut au chargement de l'application
  useEffect(() => {
    if (currentTokenId && !alveolesImage) {
      const baseUrl = window.location.origin;
      const timestamp = Date.now();
      const alveoleUrl = `${baseUrl}/svg/alveoles_${currentTokenId}.png?t=${timestamp}`;
      setAlveolesImage(alveoleUrl);
    }
  }, [currentTokenId, alveolesImage]);

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
                          {processing ? (
                            <p className="text-gray-500">Traitement en cours...</p>
                          ) : alveolesImage ? (
                            <img 
                              src={alveolesImage} 
                              alt="Image des alvéoles" 
                              className="w-full h-auto"
                            />
                          ) : (
                            <p className="text-gray-500">Chargez un Cover Flex pour voir l'image</p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={handleDownloadImage}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center"
                        disabled={!currentTokenId}
                      >
                        <Download className="w-5 h-5 mr-2" />
                        {currentTokenId ? `Télécharger l'image pour votre Flex #${currentTokenId}` : "Télécharger l'image pour votre Flex"}
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