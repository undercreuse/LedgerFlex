import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NFTMetadata } from '../types';
import { useNFTOwnership } from './useNFTOwnership';

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
  
  // Utiliser le hook useNFTOwnership pour vérifier la propriété des NFTs du contrat spécifique
  const { checkOwnership, loading: ownershipLoading } = useNFTOwnership();

  useEffect(() => {
    const fetchNFTs = async () => {
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

        // Si aucun chainId n'est spécifié, on récupère les NFTs de tous les réseaux supportés
        const chainsToFetch = chainId 
          ? [SUPPORTED_CHAINS.find(chain => chain.chainId.toLowerCase() === chainId.toLowerCase())?.id || 'ethereum'] 
          : SUPPORTED_CHAINS.map(chain => chain.id);

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
        
        // Vérifier également les NFTs du contrat spécifique sur le réseau sélectionné
        if (chainId) {
          try {
            const selectedChain = SUPPORTED_CHAINS.find(chain => chain.chainId.toLowerCase() === chainId.toLowerCase());
            if (selectedChain) {
              console.log(`Checking ownership for contract on ${selectedChain.name}`);
              
              // Créer un objet NetworkInfo complet avec la couleur
              const networkInfo = {
                id: selectedChain.id,
                name: selectedChain.name,
                chainId: selectedChain.chainId,
                color: getNetworkColor(selectedChain.id)
              };
              
              const { isOwner, tokenIds } = await checkOwnership(address, networkInfo);
              
              if (isOwner && tokenIds.length > 0) {
                // Ajouter les NFTs du contrat spécifique
                tokenIds.forEach(tokenId => {
                  // Vérifier si ce NFT n'est pas déjà dans la liste
                  const exists = allNfts.some(nft => 
                    nft.chain === selectedChain.id && nft.tokenId === tokenId
                  );
                  
                  if (!exists) {
                    allNfts.push({
                      id: `${selectedChain.id}-contract-${tokenId}`,
                      imageUrl: `/nft-images/${tokenId}.png`, // Image par défaut ou à charger dynamiquement
                      name: `LedgerStax NFT #${tokenId}`,
                      tokenId: tokenId,
                      chain: selectedChain.id,
                      contractAddress: 'CONTRACT_ADDRESS', // Remplacer par l'adresse réelle
                      collection: 'LedgerStax Collection'
                    });
                  }
                });
                
                // S'assurer que ce réseau est dans la liste des réseaux trouvés
                if (!foundChains.includes(selectedChain.id)) {
                  foundChains.push(selectedChain.id);
                }
              }
            }
          } catch (err) {
            console.error('Error checking contract ownership:', err);
          }
        }

        setNfts(allNfts);
        setAvailableChains(foundChains);
        
        if (allNfts.length === 0) {
          setError('No NFTs found for this address on the selected networks');
        }
      } catch (err) {
        setError('Failed to fetch NFTs from OpenSea. Please try again later.');
        console.error('Error fetching NFTs:', err);
      } finally {
        setLoading(false);
      }
    };

    if (address) {
      fetchNFTs();
    } else {
      setNfts([]);
      setLoading(false);
    }
  }, [address, chainId, checkOwnership]);

  return { nfts, loading: loading || ownershipLoading, error, availableChains };
};

// Fonction pour attribuer une couleur à chaque réseau
function getNetworkColor(networkId: string): string {
  const colors = {
    'ethereum': 'bg-blue-500',
    'base': 'bg-blue-400',
    'optimism': 'bg-red-500',
    'zora': 'bg-purple-500',
    'arbitrum': 'bg-blue-600',
    'polygon': 'bg-indigo-500',
    'avalanche': 'bg-red-600'
  };
  return colors[networkId as keyof typeof colors] || 'bg-gray-500';
}