import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NFTMetadata } from '../types';

const OPENSEA_API_URL = 'https://api.opensea.io/api/v2';
const API_KEY = import.meta.env.VITE_OPENSEA_API_KEY;

// Liste des réseaux supportés par OpenSea API v2
export const SUPPORTED_CHAINS = [
  { id: 'ethereum', name: 'Ethereum', chainId: '0x1' },
  { id: 'base', name: 'Base', chainId: '0x2105' },
  { id: 'optimism', name: 'Optimism', chainId: '0xa' },
  { id: 'zora', name: 'Zora', chainId: '0x76adf1' },
  { id: 'arbitrum', name: 'Arbitrum', chainId: '0xa4b1' },
  { id: 'polygon', name: 'Polygon', chainId: '0x89' },
  { id: 'avalanche', name: 'Avalanche', chainId: '0xa86a' }
];

export const getChainNameById = (chainId: string): string => {
  const chain = SUPPORTED_CHAINS.find(chain => chain.chainId.toLowerCase() === chainId.toLowerCase());
  return chain ? chain.name : 'Réseau inconnu';
};

export const getChainIdByName = (name: string): string | undefined => {
  const chain = SUPPORTED_CHAINS.find(chain => chain.name.toLowerCase() === name.toLowerCase());
  return chain?.chainId;
};

export const useNFTs = (address: string, chainId?: string) => {
  const [nfts, setNfts] = useState<NFTMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableChains, setAvailableChains] = useState<string[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);

  // Fonction pour récupérer les NFTs
  const fetchNFTsForChains = async (chainsToFetch: string[]) => {
    if (!ethers.isAddress(address)) {
      setError('Invalid Ethereum address');
      setLoading(false);
      return;
    }

    if (!API_KEY) {
      setError('OpenSea API key is not configured');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setNfts([]);

      const allNfts: NFTMetadata[] = [];
      const foundChains: string[] = [];

      // Récupérer les NFTs pour chaque réseau
      await Promise.all(chainsToFetch.map(async (chainName) => {
        try {
          console.log(`Fetching NFTs for chain: ${chainName}`);
          const response = await fetch(
            `${OPENSEA_API_URL}/chain/${chainName}/account/${address}/nfts`,
            {
              headers: {
                'accept': 'application/json',
                'x-api-key': API_KEY
              }
            }
          );

          if (!response.ok) {
            console.warn(`Error fetching NFTs for chain ${chainName}: ${response.status}`);
            return;
          }

          const data = await response.json();
          
          if (data.nfts && data.nfts.length > 0) {
            foundChains.push(chainName);
            
            // Process each NFT from the OpenSea response
            data.nfts.forEach((nft: any) => {
              if (nft.image_url) {
                allNfts.push({
                  id: `${chainName}-${nft.identifier}`,
                  imageUrl: nft.image_url,
                  name: nft.name || `NFT #${nft.identifier}`,
                  tokenId: nft.identifier,
                  chain: chainName,
                  contractAddress: nft.contract,
                  collection: nft.collection
                });
              }
            });
          }
        } catch (err) {
          console.error(`Error fetching NFTs for chain ${chainName}:`, err);
        }
      }));

      setNfts(allNfts);
      setAvailableChains(foundChains);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching NFTs:', error);
      setError('Failed to fetch NFTs. Please try again later.');
      setLoading(false);
    }
  };

  // Effet pour récupérer les NFTs au chargement initial
  useEffect(() => {
    if (address) {
      // Si aucun chainId n'est spécifié, on récupère les NFTs de tous les réseaux supportés
      const chainsToFetch = chainId 
        ? [SUPPORTED_CHAINS.find(chain => chain.chainId.toLowerCase() === chainId.toLowerCase())?.id || 'ethereum'] 
        : SUPPORTED_CHAINS.map(chain => chain.id);
      
      fetchNFTsForChains(chainsToFetch);
    }
  }, [address, chainId]);

  // Fonction pour changer de réseau
  const changeNetwork = (networkId: string | null) => {
    setSelectedNetwork(networkId);
    
    if (address) {
      if (networkId) {
        // Récupérer les NFTs uniquement pour le réseau sélectionné
        fetchNFTsForChains([networkId]);
      } else {
        // Récupérer les NFTs pour tous les réseaux
        fetchNFTsForChains(SUPPORTED_CHAINS.map(chain => chain.id));
      }
    }
  };

  return {
    nfts,
    loading,
    error,
    availableChains,
    selectedNetwork,
    changeNetwork
  };
};