import React, { useState } from 'react';
import { Loader2, Filter } from 'lucide-react';
import { NFTMetadata } from '../types';
import { useNFTs } from '../hooks/useNFTs';

interface NFTSelectorProps {
  requiredCount: number;
  walletAddress: string;
  isProcessing: boolean;
  chainId?: string;
}

export const NFTSelector: React.FC<NFTSelectorProps> = ({
  requiredCount,
  walletAddress,
  isProcessing,
  chainId
}) => {
  const { nfts, loading, error, availableChains } = useNFTs(walletAddress, chainId);
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [showChainFilter, setShowChainFilter] = useState(false);
  
  // Fonction pour gérer le début du drag
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, nft: NFTMetadata) => {
    e.dataTransfer.setData('application/json', JSON.stringify(nft));
    e.dataTransfer.effectAllowed = 'copy';
    
    // Créer une image de prévisualisation pour le drag
    const img = new Image();
    img.src = nft.imageUrl;
    e.dataTransfer.setDragImage(img, 50, 50);
  };

  // Filtrer les NFTs par réseau si un filtre est sélectionné
  const filteredNfts = selectedChain 
    ? nfts.filter(nft => nft.chain === selectedChain)
    : nfts;

  // Obtenir les réseaux disponibles à partir des NFTs
  const networkOptions = availableChains && availableChains.length > 0
    ? availableChains
    : [];

  // Fonction pour réinitialiser le filtre
  const resetFilter = () => {
    setSelectedChain(null);
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-gray-600">Chargement des NFTs...</span>
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Vos NFTs</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            {requiredCount} cellules disponibles
          </span>
          {networkOptions.length > 1 && (
            <div className="relative">
              <button 
                onClick={() => setShowChainFilter(!showChainFilter)}
                className="flex items-center space-x-1 px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                <Filter className="w-4 h-4" />
                <span>{selectedChain ? `Réseau: ${selectedChain}` : 'Tous les réseaux'}</span>
              </button>
              
              {showChainFilter && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        resetFilter();
                        setShowChainFilter(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100"
                    >
                      Tous les réseaux
                    </button>
                    
                    {networkOptions.map((chain) => (
                      <button
                        key={chain}
                        onClick={() => {
                          setSelectedChain(chain);
                          setShowChainFilter(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center"
                      >
                        <span>{chain.charAt(0).toUpperCase() + chain.slice(1)}</span>
                        {chain === selectedChain && (
                          <span className="ml-auto text-green-500">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedChain && (
        <div className="mb-4 flex items-center">
          <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center">
            Filtré par: {selectedChain.charAt(0).toUpperCase() + selectedChain.slice(1)}
            <button 
              onClick={resetFilter}
              className="ml-2 text-blue-600 hover:text-blue-800"
            >
              ×
            </button>
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredNfts.map((nft) => {
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
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1">
                <div className="truncate">{nft.name || `NFT #${nft.tokenId}`}</div>
                {nft.chain && (
                  <div className="text-xs text-gray-300 truncate">
                    {nft.chain.charAt(0).toUpperCase() + nft.chain.slice(1)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredNfts.length === 0 && (
        <p className="text-center text-gray-500 my-8">
          {selectedChain 
            ? `Aucun NFT trouvé sur le réseau ${selectedChain} pour cette adresse`
            : 'Aucun NFT trouvé pour cette adresse'}
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