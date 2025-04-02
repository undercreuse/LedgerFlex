import React, { useState, useEffect } from 'react';
import { Loader2, Filter } from 'lucide-react';
import { NFTMetadata } from '../types';
import { useNFTs, SUPPORTED_CHAINS } from '../hooks/useNFTs';

interface NFTSelectorProps {
  requiredCount: number;
  walletAddress: string;
  chainId?: string;
}

export const NFTSelector: React.FC<NFTSelectorProps> = ({
  requiredCount,
  walletAddress,
  chainId
}) => {
  const { nfts, loading, error, availableChains, selectedNetwork, changeNetwork } = useNFTs(walletAddress, chainId);
  const [showChainFilter, setShowChainFilter] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<NFTMetadata | null>(null);
  
  // Mettre à jour le NFT sélectionné quand les NFTs sont chargés
  useEffect(() => {
    if (nfts.length > 0 && !selectedNFT) {
      setSelectedNFT(nfts[0]);
    }
  }, [nfts, selectedNFT]);
  
  // Fonction pour gérer le début du drag
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, nft: NFTMetadata) => {
    e.dataTransfer.setData('application/json', JSON.stringify(nft));
    e.dataTransfer.effectAllowed = 'copy';
    
    // Créer une image de prévisualisation pour le drag
    const img = new Image();
    img.src = nft.imageUrl;
    e.dataTransfer.setDragImage(img, 50, 50);
  };

  // Obtenir les réseaux disponibles à partir des NFTs
  const networkOptions = availableChains && availableChains.length > 0
    ? availableChains
    : [];

  // Fonction pour réinitialiser le filtre
  const resetFilter = () => {
    changeNetwork(null);
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-600">Chargement de vos NFTs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="text-center">
          <div className="text-red-500 mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-red-600 mb-2">Erreur</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Sélectionner un réseau</h2>
      </div>

      {/* Sélecteur de réseau */}
      <div className="mb-6">
        <select
          className="w-full p-3 border border-gray-300 rounded-md cursor-pointer hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={selectedNetwork || ""}
          onChange={(e) => changeNetwork(e.target.value || null)}
        >
          <option value="">Tous les réseaux</option>
          {SUPPORTED_CHAINS.map((chain) => (
            <option key={chain.id} value={chain.id}>
              {chain.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Vos NFTs</h2>
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
                <span>{selectedNetwork ? `Réseau: ${selectedNetwork}` : 'Tous les réseaux'}</span>
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
                          changeNetwork(chain);
                          setShowChainFilter(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center"
                      >
                        <span>{chain.charAt(0).toUpperCase() + chain.slice(1)}</span>
                        {chain === selectedNetwork && (
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

      {selectedNetwork && (
        <div className="mb-4 flex items-center">
          <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center">
            Filtré par: {selectedNetwork.charAt(0).toUpperCase() + selectedNetwork.slice(1)}
            <button 
              onClick={resetFilter}
              className="ml-2 text-blue-600 hover:text-blue-800"
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* Grille de NFTs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {nfts.map((nft) => (
          <div
            key={nft.id}
            className="relative bg-gray-100 rounded-lg overflow-hidden cursor-move hover:shadow-md transition-shadow duration-200"
            draggable
            onDragStart={(e) => handleDragStart(e, nft)}
          >
            <img 
              src={nft.imageUrl} 
              alt={nft.name}
              className="w-full h-32 object-cover"
              loading="lazy"
            />
            <div className="p-2">
              <p className="text-sm font-medium truncate">{nft.name}</p>
              <p className="text-xs text-gray-500 truncate">{nft.chain}</p>
            </div>
          </div>
        ))}
      </div>

      {nfts.length === 0 && (
        <p className="text-center text-gray-500 my-8">
          {selectedNetwork 
            ? `Aucun NFT trouvé sur le réseau ${selectedNetwork} pour cette adresse`
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