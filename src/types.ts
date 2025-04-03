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
  id: string | number;
  imageUrl: string;
  name: string;
  tokenId: string;
  chain?: string;
  contractAddress?: string;
  collection?: string;
}

export interface NetworkInfo {
  id: string;
  name: string;
  chainId: string;
  color: string;
}