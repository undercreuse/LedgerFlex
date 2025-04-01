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
  }, [selectedNfts]); // Intentionally omit onNFTsSelected to prevent infinite loop

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
            <button
              key={nft.id}
              onClick={() => handleNFTSelect(nft)}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              disabled={isProcessing || (selectedNfts.length >= requiredCount && !isSelected)}
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
            </button>
          );
        })}
      </div>

      {nfts.length === 0 && (
        <p className="text-center text-gray-500">
          No NFTs found for this address
        </p>
      )}
    </div>
  );
};