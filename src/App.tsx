import React, { useState } from 'react';
import { Web3Connect } from './components/Web3Connect';
import { SVGUploader } from './components/SVGUploader';
import { NFTSelector } from './components/NFTSelector';
import { SVGShape, NFTMetadata } from './types';
import { applyMaskToImage } from './utils/svgProcessor';

function App() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [shapes, setShapes] = useState<SVGShape[]>([]);
  const [nfts, setNfts] = useState<NFTMetadata[]>([]);
  const [maskedImages, setMaskedImages] = useState<HTMLCanvasElement[]>([]);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = (walletAddress: string) => {
    setConnected(true);
    setAddress(walletAddress);
  };

  const handleSVGLoad = (loadedShapes: SVGShape[]) => {
    setShapes(loadedShapes);
    setNfts([]);
    setMaskedImages([]);
    setFinalImage(null);
    setError(null);
  };

  // Fonction pour gérer le drop d'un NFT sur une cellule spécifique
  const handleCellDrop = (cellIndex: number, nft: NFTMetadata) => {
    if (processing) return;
    
    try {
      setError(null);
      setProcessing(true);
      
      // Créer une nouvelle liste de NFTs avec le NFT déposé à la position cellIndex
      const newNfts = [...nfts];
      
      // Si cette cellule est déjà occupée, on échange les NFTs
      const existingNftIndex = newNfts.findIndex(n => n && n.id === nft.id);
      
      // Mettre à jour la cellule avec le nouveau NFT
      newNfts[cellIndex] = nft;
      
      // Si le NFT était déjà dans une autre cellule, la vider
      if (existingNftIndex !== -1 && existingNftIndex !== cellIndex) {
        newNfts[existingNftIndex] = undefined as any;
      }
      
      // Mettre à jour l'état
      setNfts(newNfts);
      
      // Traiter les images masquées
      processNFTImages(newNfts.filter(Boolean));
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
  ) => {
    finalCanvas.width = viewBox.width;
    finalCanvas.height = viewBox.height;

    const ctx = finalCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    ctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);

    // Draw all masked images in order
    for (const canvas of images) {
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Invalid masked image dimensions');
      }
      ctx.drawImage(canvas, 0, 0);
    }

    const dataUrl = finalCanvas.toDataURL('image/png', 1.0);
    if (!dataUrl || dataUrl === 'data:,' || dataUrl === 'data:image/png;base64,') {
      throw new Error('Failed to generate valid final image');
    }

    return dataUrl;
  };

  // Fonction pour traiter les images NFT et créer les masques
  const processNFTImages = async (selectedNfts: NFTMetadata[]) => {
    try {
      // Réinitialiser les images masquées pour les recréer toutes
      setMaskedImages([]);
      
      // Créer un tableau pour stocker les nouvelles images masquées
      const newMaskedImages: HTMLCanvasElement[] = [];

      // Traiter chaque NFT sélectionné avec sa forme correspondante
      for (let i = 0; i < selectedNfts.length; i++) {
        const currentNft = selectedNfts[i];
        
        // Trouver l'index de la forme correspondante dans le tableau shapes
        // Pour le drag and drop, l'index peut ne pas correspondre à l'ordre des NFTs
        const shapeIndex = nfts.findIndex(n => n && n.id === currentNft.id);
        const currentShape = shapes[shapeIndex !== -1 ? shapeIndex : i];

        if (!currentNft || !currentShape) {
          console.warn(`NFT ou forme manquante pour l'index ${i}`);
          continue;
        }

        // Créer et charger l'image
        const image = new Image();
        image.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout loading image ${i + 1}`));
          }, 30000);

          image.onload = async () => {
            clearTimeout(timeoutId);
            try {
              if (image.width === 0 || image.height === 0) {
                throw new Error('Invalid image dimensions');
              }

              // Créer un nouveau canvas pour cette image masquée
              const maskedCanvas = document.createElement('canvas');
              maskedCanvas.width = currentShape.viewBox.width;
              maskedCanvas.height = currentShape.viewBox.height;

              // Appliquer le masque à l'image
              await applyMaskToImage(image, currentShape, maskedCanvas);

              // Vérifier que le canvas masqué a un contenu valide
              const maskedCtx = maskedCanvas.getContext('2d');
              if (!maskedCtx) throw new Error('Could not get masked canvas context');

              const imageData = maskedCtx.getImageData(
                0, 0, maskedCanvas.width, maskedCanvas.height
              );
              if (!imageData.data.some(pixel => pixel !== 0)) {
                throw new Error('Masked image is empty');
              }

              // Ajouter le canvas masqué à notre collection temporaire
              newMaskedImages.push(maskedCanvas);

              resolve();
            } catch (err) {
              reject(err);
            }
          };

          image.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error(`Failed to load image ${i + 1} from URL: ${currentNft.imageUrl}`));
          };

          // Ajouter un mécanisme anti-cache et de réessai
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
              setTimeout(loadImage, 1000 * retryCount); // Backoff exponentiel
            } else {
              reject(new Error(`Failed to load image after ${maxRetries} attempts: ${currentNft.imageUrl}`));
            }
          };

          loadImage();
        });
      }

      // Mettre à jour l'état avec toutes les images masquées
      setMaskedImages(newMaskedImages);
      
      // Afficher le nombre d'images masquées créées
      console.log(`${newMaskedImages.length} images masquées créées`);

      // Si nous avons des images, fusionnez-les
      if (newMaskedImages.length > 0) {
        const finalCanvas = canvasRef.current;
        if (!finalCanvas) throw new Error('Canvas not available');

        const dataUrl = await mergeMaskedImages(
          newMaskedImages,
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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header - Toujours visible */}
      <header className="w-full bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Web3Connect onConnect={handleConnect} />
        </div>
      </header>

      {/* Contenu principal */}
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
            {/* Configuration Column */}
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
                
                {/* Afficher le nombre d'images masquées */}
                {maskedImages.length > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                      {maskedImages.length} images masquées créées
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* NFT Selection Column */}
            <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
              <div className="space-y-6">
                {shapes.length > 0 && (
                  <NFTSelector
                    requiredCount={shapes.length}
                    walletAddress={address}
                    isProcessing={processing}
                  />
                )}

                {finalImage && (
                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold mb-4">Final Result</h3>
                    <img
                      src={finalImage}
                      alt="Processed NFT Composition"
                      className="w-full h-auto rounded-lg"
                    />
                  </div>
                )}
              </div>
            </div>

            <canvas
              ref={canvasRef}
              className="hidden"
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;