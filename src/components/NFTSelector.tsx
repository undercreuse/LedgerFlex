import React from 'react';
import { Loader2 } from 'lucide-react';
import { NFTMetadata } from '../types';
import { useNFTs } from '../hooks/useNFTs';

interface NFTSelectorProps {
  requiredCount: number;
  walletAddress: string;
  isProcessing: boolean;
}

export const NFTSelector: React.FC<NFTSelectorProps> = ({
  requiredCount,
  walletAddress,
  isProcessing
}) => {
  const { nfts, loading, error } = useNFTs(walletAddress);
  // Nous n'avons plus besoin de suivre les NFTs sélectionnés ici
  // car la sélection se fait uniquement par drag and drop
  
  // Fonction pour gérer le début du drag
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, nft: NFTMetadata) => {
    e.dataTransfer.setData('application/json', JSON.stringify(nft));
    e.dataTransfer.effectAllowed = 'copy';
    
    // Créer une image de prévisualisation pour le drag
    const img = new Image();
    img.src = nft.imageUrl;
    e.dataTransfer.setDragImage(img, 50, 50);
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-gray-600">Loading NFTs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Vos NFTs</h3>
        <span className="text-sm text-gray-500">
          {requiredCount} cellules disponibles
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {nfts.map((nft) => {
          return (
            <div
              key={nft.id}
              draggable
              onDragStart={(e) => handleDragStart(e, nft)}
              className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-gray-300 transition-all cursor-grab"
            >
              <img
                src={nft.imageUrl}
                alt={nft.name}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
              {isProcessing && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-70 text-white text-xs p-1 rounded truncate">
                {nft.name || `NFT #${nft.tokenId}`}
              </div>
            </div>
          );
        })}
      </div>

      {nfts.length === 0 && (
        <p className="text-center text-gray-500">
          No NFTs found for this address
        </p>
      )}
      
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-700">
          <strong>Astuce :</strong> Glissez-déposez les NFTs directement sur les cellules du SVG pour les placer précisément où vous le souhaitez.
        </p>
      </div>
    </div>
  );
};