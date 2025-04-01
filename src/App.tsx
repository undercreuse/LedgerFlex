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

  const handleNFTsSelected = async (selectedNfts: NFTMetadata[]) => {
    if (processing) return;

    try {
      setError(null);
      setProcessing(true);

      // Get the latest selected NFT
      const currentNft = selectedNfts[selectedNfts.length - 1];
      const currentShape = shapes[selectedNfts.length - 1];

      if (!currentNft || !currentShape) {
        throw new Error('Invalid NFT or shape selection');
      }

      // Create and load the image
      const image = new Image();
      image.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Timeout loading image ${selectedNfts.length}`));
        }, 30000);

        image.onload = async () => {
          clearTimeout(timeoutId);
          try {
            if (image.width === 0 || image.height === 0) {
              throw new Error('Invalid image dimensions');
            }

            // Create a new canvas for this masked image
            const maskedCanvas = document.createElement('canvas');
            maskedCanvas.width = currentShape.viewBox.width;
            maskedCanvas.height = currentShape.viewBox.height;

            // Apply mask to the image
            await applyMaskToImage(image, currentShape, maskedCanvas);

            // Verify the masked canvas has valid content
            const maskedCtx = maskedCanvas.getContext('2d');
            if (!maskedCtx) throw new Error('Could not get masked canvas context');

            const imageData = maskedCtx.getImageData(
              0, 0, maskedCanvas.width, maskedCanvas.height
            );
            if (!imageData.data.some(pixel => pixel !== 0)) {
              throw new Error('Masked image is empty');
            }

            // Add the masked canvas to our collection
            setMaskedImages(prev => [...prev, maskedCanvas]);

            // If we have all images, merge them
            if (selectedNfts.length === shapes.length) {
              const finalCanvas = canvasRef.current;
              if (!finalCanvas) throw new Error('Canvas not available');

              const dataUrl = await mergeMaskedImages(
                [...maskedImages, maskedCanvas],
                finalCanvas,
                currentShape.viewBox
              );

              setFinalImage(dataUrl);
            }

            resolve();
          } catch (err) {
            reject(err);
          }
        };

        image.onerror = () => {
          clearTimeout(timeoutId);
          reject(new Error(`Failed to load image ${selectedNfts.length} from URL: ${currentNft.imageUrl}`));
        };

        // Add cache-busting and retry mechanism
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
            setTimeout(loadImage, 1000 * retryCount); // Exponential backoff
          } else {
            reject(new Error(`Failed to load image after ${maxRetries} attempts: ${currentNft.imageUrl}`));
          }
        };

        loadImage();
      });

      setNfts(selectedNfts);
    } catch (err) {
      console.error('Error processing image:', err);
      setError(err instanceof Error ? err.message : 'Failed to process image');
      // Remove the last selected NFT if there was an error
      setNfts(prev => prev.slice(0, -1));
      setMaskedImages(prev => prev.slice(0, -1));
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
                />
                
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600 text-sm">{error}</p>
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
                    onNFTsSelected={handleNFTsSelected}
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