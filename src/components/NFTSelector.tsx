import React from 'react';
import { Loader2 } from 'lucide-react';
import { NFTMetadata } from '../types';
import { useNFTs } from '../hooks/useNFTs';

interface NFTSelectorProps {
  requiredCount: number;
  walletAddress: string;
  onNFTsSelected: (nfts: NFTMetadata[]) => void;
  isProcessing: boolean;
}

export const NFTSelector: React.FC<NFTSelectorProps> = ({
  requiredCount,
  walletAddress,
  onNFTsSelected,
  isProcessing
}) => {
  const { nfts, loading, error } = useNFTs(walletAddress);
  const [selectedNfts, setSelectedNfts] = React.useState<NFTMetadata[]>([]);
  const previousSelectedNftsRef = React.useRef<NFTMetadata[]>([]);

  // Only call onNFTsSelected when selectedNfts actually changes and is different from previous
  React.useEffect(() => {
    if (selectedNfts.length > 0 && 
        JSON.stringify(selectedNfts) !== JSON.stringify(previousSelectedNftsRef.current)) {
      previousSelectedNftsRef.current = selectedNfts;
      onNFTsSelected(selectedNfts);
    }
  }, [selectedNfts, onNFTsSelected]);

  const handleNFTSelect = (nft: NFTMetadata) => {
    if (isProcessing) return;
    
    setSelectedNfts(prev => {
      const isSelected = prev.find(n => n.id === nft.id);
      if (isSelected) {
        return prev.filter(n => n.id !== nft.id);
      } else if (prev.length < requiredCount) {
        return [...prev, nft];
      }
      return prev;
    });
  };

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
        <h3 className="text-lg font-semibold">Select NFTs</h3>
        <span className="text-sm text-gray-500">
          {selectedNfts.length}/{requiredCount} selected
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {nfts.map((nft) => {
          const selectedIndex = selectedNfts.findIndex(n => n.id === nft.id);
          const isSelected = selectedIndex !== -1;
          return (
            <div
              key={nft.id}
              draggable
              onDragStart={(e) => handleDragStart(e, nft)}
              onClick={() => handleNFTSelect(nft)}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-grab ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <img
                src={nft.imageUrl}
                alt={nft.name}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
              {isSelected && (
                <>
                  <div className="absolute inset-0 bg-blue-500 bg-opacity-20" />
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-500">
                      {selectedIndex + 1}
                    </span>
                  </div>
                </>
              )}
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
          <strong>Astuce :</strong> Vous pouvez glisser-déposer les NFTs directement sur les cellules du SVG pour les placer précisément où vous le souhaitez.
        </p>
      </div>
    </div>
  );
};