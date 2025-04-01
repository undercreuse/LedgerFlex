export interface SVGShape {
  id: number;
  path: string;
  center: { x: number; y: number };
  bounds: { width: number; height: number };
  viewBox: {
    width: number;
    height: number;
    minX: number;
    minY: number;
  };
}

export interface NFTMetadata {
  id: number;
  imageUrl: string;
  name: string;
  tokenId: string;
}