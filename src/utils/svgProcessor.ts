import { SVGShape } from '../types';

const convertRectToPath = (rect: SVGRectElement): string => {
  const x = parseFloat(rect.getAttribute('x') || '0');
  const y = parseFloat(rect.getAttribute('y') || '0');
  const width = parseFloat(rect.getAttribute('width') || '0');
  const height = parseFloat(rect.getAttribute('height') || '0');
  
  return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
};

const convertEllipseToPath = (ellipse: SVGEllipseElement): string => {
  const cx = parseFloat(ellipse.getAttribute('cx') || '0');
  const cy = parseFloat(ellipse.getAttribute('cy') || '0');
  const rx = parseFloat(ellipse.getAttribute('rx') || '0');
  const ry = parseFloat(ellipse.getAttribute('ry') || '0');
  
  const k = 0.5522848;
  const ox = rx * k;
  const oy = ry * k;
  
  return `M ${cx - rx} ${cy}
    C ${cx - rx} ${cy - oy} ${cx - ox} ${cy - ry} ${cx} ${cy - ry}
    C ${cx + ox} ${cy - ry} ${cx + rx} ${cy - oy} ${cx + rx} ${cy}
    C ${cx + rx} ${cy + oy} ${cx + ox} ${cy + ry} ${cx} ${cy + ry}
    C ${cx - ox} ${cy + ry} ${cx - rx} ${cy + oy} ${cx - rx} ${cy}
    Z`;
};

const convertUnits = (value: string): number => {
  if (!value) return 0;
  
  value = value.trim();
  const negative = value.startsWith('-');
  if (negative) value = value.slice(1);

  const match = value.match(/^([\d.]+)(mm|cm|in|pt|pc|px)?$/);
  if (!match) return parseFloat(value) || 0;

  const num = parseFloat(match[1]);
  const unit = match[2] || 'px';

  const conversions: { [key: string]: number } = {
    mm: 3.7795275591,
    cm: 37.795275591,
    in: 96,
    pt: 1.3333333333,
    pc: 16,
    px: 1
  };

  return (negative ? -1 : 1) * num * (conversions[unit] || 1);
};

const normalizeViewBox = (svg: SVGElement): { minX: number, minY: number, width: number, height: number } => {
  const viewBoxAttr = svg.getAttribute('viewBox');
  
  if (viewBoxAttr) {
    const [minX, minY, width, height] = viewBoxAttr.split(' ').map(parseFloat);
    return { minX, minY, width, height };
  }
  
  // Si pas de viewBox, essayer d'utiliser les attributs width et height
  const widthAttr = svg.getAttribute('width');
  const heightAttr = svg.getAttribute('height');
  
  if (widthAttr && heightAttr) {
    const width = convertUnits(widthAttr);
    const height = convertUnits(heightAttr);
    return { minX: 0, minY: 0, width, height };
  }
  
  // Si on a un élément SVGSVGElement, on peut utiliser getBBox()
  if (svg instanceof SVGSVGElement && svg.getBBox) {
    try {
      const bbox = svg.getBBox();
      return { minX: bbox.x, minY: bbox.y, width: bbox.width, height: bbox.height };
    } catch (e) {
      console.error('Error getting bbox:', e);
    }
  }
  
  // Valeur par défaut
  return { minX: 0, minY: 0, width: 300, height: 150 };
};

const calculateShapeBounds = (path: SVGPathElement): { 
  bbox: DOMRect,
  center: { x: number, y: number }
} => {
  const bbox = path.getBBox();
  return {
    bbox,
    center: {
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height / 2
    }
  };
};

export const extractShapesFromSVG = (svgContent: string): SVGShape[] => {
  let tempSvg: SVGSVGElement | null = null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    
    if (!svg) {
      throw new Error('Invalid SVG content');
    }

    if (doc.querySelector('parsererror')) {
      throw new Error('SVG parsing error');
    }

    const viewBox = normalizeViewBox(svg);

    tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tempSvg.setAttribute('width', viewBox.width.toString());
    tempSvg.setAttribute('height', viewBox.height.toString());
    tempSvg.setAttribute('viewBox', `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`);
    document.body.appendChild(tempSvg);

    const shapes: SVGShape[] = [];
    let shapeIndex = 0;

    const processElement = (element: Element) => {
      let pathData: string | null = null;
      const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');

      if (element instanceof SVGPathElement) {
        pathData = element.getAttribute('d');
      } else if (element instanceof SVGRectElement) {
        pathData = convertRectToPath(element);
      } else if (element instanceof SVGEllipseElement) {
        pathData = convertEllipseToPath(element);
      }

      if (pathData) {
        tempPath.setAttribute('d', pathData);
        tempSvg!.appendChild(tempPath);
        
        try {
          const { bbox, center } = calculateShapeBounds(tempPath);
          
          if (bbox.width > 0 && bbox.height > 0) {
            shapes.push({
              id: ++shapeIndex,
              path: pathData,
              center,
              bounds: {
                width: bbox.width,
                height: bbox.height
              },
              viewBox: {
                width: viewBox.width,
                height: viewBox.height,
                minX: viewBox.minX,
                minY: viewBox.minY
              }
            });
          }
        } catch (error) {
          console.warn('Failed to process shape:', error);
        }
        
        tempSvg!.removeChild(tempPath);
      }
    };

    const processElements = (parent: Element) => {
      Array.from(parent.children).forEach(child => {
        if (child instanceof SVGGElement) {
          processElements(child);
        } else if (
          child instanceof SVGPathElement ||
          child instanceof SVGRectElement ||
          child instanceof SVGEllipseElement
        ) {
          processElement(child);
        }
      });
    };

    processElements(svg);

    if (shapes.length === 0) {
      throw new Error('No valid shapes found in SVG');
    }

    return shapes;
  } catch (error) {
    console.error('Error processing SVG:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to process SVG file');
  } finally {
    if (tempSvg && tempSvg.parentNode) {
      tempSvg.parentNode.removeChild(tempSvg);
    }
  }
};

export const applyMaskToImage = async (
  image: HTMLImageElement,
  shape: SVGShape,
  canvas: HTMLCanvasElement,
  grayscale: boolean = true
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Create a path for clipping
      const path = new Path2D(shape.path);

      // Calculate scaling to fit image within shape bounds while maintaining aspect ratio
      const scaleX = shape.bounds.width / image.width;
      const scaleY = shape.bounds.height / image.height;
      const scale = Math.max(scaleX, scaleY);

      // Calculate position to center the image within the shape
      const scaledWidth = image.width * scale;
      const scaledHeight = image.height * scale;
      const x = shape.center.x - scaledWidth / 2;
      const y = shape.center.y - scaledHeight / 2;

      // Save the context state
      ctx.save();

      // Apply viewBox transformation
      ctx.translate(-shape.viewBox.minX, -shape.viewBox.minY);

      // Apply the clipping path
      ctx.clip(path);

      // Draw the image
      ctx.drawImage(image, x, y, scaledWidth, scaledHeight);

      // Convert to grayscale if requested
      if (grayscale) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          // Skip pixels with zero alpha (transparent pixels)
          if (data[i + 3] === 0) continue;
          
          // Calculate grayscale value using luminance formula
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          
          // Set RGB values to the grayscale value
          data[i] = gray;     // R
          data[i + 1] = gray; // G
          data[i + 2] = gray; // B
          // Alpha channel (data[i + 3]) remains unchanged
        }
        
        // Put the grayscale image data back on the canvas
        ctx.putImageData(imageData, 0, 0);
      }

      // Restore the context state
      ctx.restore();

      // Verify the canvas has valid content
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasContent = imageData.data.some((value, index) => {
        // Check alpha channel (every 4th value)
        return index % 4 === 3 && value > 0;
      });

      if (!hasContent) {
        throw new Error('Generated image is empty');
      }

      resolve();
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Unknown error processing image'));
    }
  });
};