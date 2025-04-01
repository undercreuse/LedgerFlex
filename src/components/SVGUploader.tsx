import React from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { SVGShape, NFTMetadata } from '../types';
import { extractShapesFromSVG } from '../utils/svgProcessor';
import { applyMaskToImage } from '../utils/svgProcessor';

interface SVGUploaderProps {
  onSVGLoad: (shapes: SVGShape[]) => void;
  selectedNfts?: NFTMetadata[];
}

export const SVGUploader: React.FC<SVGUploaderProps> = ({ onSVGLoad, selectedNfts = [] }) => {
  const [error, setError] = React.useState<string>('');
  const [svgPreview, setSvgPreview] = React.useState<string | null>(null);
  const previewCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [shapes, setShapes] = React.useState<SVGShape[]>([]);

  const renderPreview = async (svgContent: string, shapes: SVGShape[], selectedNfts: NFTMetadata[]) => {
    const canvas = previewCanvasRef.current;
    if (!canvas || shapes.length === 0) return;

    // Use the viewBox from the first shape (all shapes share the same viewBox)
    const viewBox = shapes[0].viewBox;
    const maxPreviewSize = 300;

    // Calculate scale to fit within preview size while maintaining aspect ratio
    const scale = Math.min(
      maxPreviewSize / viewBox.width,
      maxPreviewSize / viewBox.height
    );

    // Set canvas dimensions based on viewBox and scale
    canvas.width = viewBox.width * scale;
    canvas.height = viewBox.height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the SVG
    const img = new Image();
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
      img.onload = async () => {
        try {
          ctx.save();
          
          // Scale everything according to the preview size
          ctx.scale(scale, scale);
          
          // Apply viewBox translation
          ctx.translate(-viewBox.minX, -viewBox.minY);
          
          // Draw the SVG
          ctx.drawImage(img, viewBox.minX, viewBox.minY, viewBox.width, viewBox.height);

          // Process each shape
          for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];
            const selectedNft = selectedNfts[i];

            if (selectedNft) {
              // Create a temporary canvas for the masked NFT
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = viewBox.width;
              tempCanvas.height = viewBox.height;

              // Load and mask the NFT image
              const nftImage = new Image();
              nftImage.crossOrigin = 'anonymous';
              
              await new Promise<void>((resolveNft, rejectNft) => {
                nftImage.onload = async () => {
                  try {
                    await applyMaskToImage(nftImage, shape, tempCanvas);
                    
                    // Draw the masked NFT onto the preview canvas
                    ctx.drawImage(tempCanvas, 0, 0);
                    resolveNft();
                  } catch (err) {
                    rejectNft(err);
                  }
                };
                nftImage.onerror = () => rejectNft(new Error('Failed to load NFT image'));
                nftImage.src = selectedNft.imageUrl + `?t=${Date.now()}`;
              });
            } else {
              // For unselected shapes, draw the number
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

              // Draw text stroke
              ctx.strokeText(text, x, y);
              // Draw text fill
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

  // Update preview when selectedNfts changes
  React.useEffect(() => {
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

  return (
    <div className="space-y-4">
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
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {svgPreview && shapes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Preview</h3>
          <div className="border rounded-lg overflow-hidden bg-white p-4 flex justify-center">
            <canvas
              ref={previewCanvasRef}
              className="max-w-full h-auto"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Original dimensions: {Math.round(shapes[0].viewBox.width)} x {Math.round(shapes[0].viewBox.height)}
          </p>
        </div>
      )}
    </div>
  );
};