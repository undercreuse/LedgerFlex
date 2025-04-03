import { useState, useCallback } from 'react';
import axios from 'axios';
import { NetworkInfo } from '../types';

interface NFTOwnershipResult {
  isOwner: boolean;
  tokenIds: string[];
  loading: boolean;
  error: string | null;
  checkOwnership: (address: string, network?: NetworkInfo) => Promise<{ isOwner: boolean; tokenIds: string[] }>;
}

// Configuration des contrats par réseau
const CONTRACTS: Record<string, { address: string, apiUrl: string }> = {
  'base': {
    address: '0xb671841488e9ab62b59a7ddc55f01e5d74cd2134',
    apiUrl: 'https://base-sepolia.g.alchemy.com/v2'
  },
  'ethereum': {
    address: '0xb671841488e9ab62b59a7ddc55f01e5d74cd2134', // Exemple, à remplacer par le vrai contrat
    apiUrl: 'https://eth-mainnet.g.alchemy.com/v2'
  },
  'optimism': {
    address: '0xb671841488e9ab62b59a7ddc55f01e5d74cd2134', // Exemple, à remplacer par le vrai contrat
    apiUrl: 'https://opt-mainnet.g.alchemy.com/v2'
  },
  'polygon': {
    address: '0xb671841488e9ab62b59a7ddc55f01e5d74cd2134', // Exemple, à remplacer par le vrai contrat
    apiUrl: 'https://polygon-mainnet.g.alchemy.com/v2'
  }
};

export const useNFTOwnership = (): NFTOwnershipResult => {
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [tokenIds, setTokenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Configuration par défaut (Base Sepolia)
  const defaultNetwork = 'base';
  const alchemyApiKey = "NCN1E4vmR2GiJN2EZCyahtwSG0h9VbMS";

  const checkOwnership = useCallback(async (address: string, network?: NetworkInfo) => {
    if (!address) {
      setError("Adresse wallet non spécifiée");
      return { isOwner: false, tokenIds: [] };
    }

    setLoading(true);
    setError(null);
    
    try {
      // Déterminer le réseau à utiliser
      const networkId = network?.id || defaultNetwork;
      const contractConfig = CONTRACTS[networkId] || CONTRACTS[defaultNetwork];
      
      if (!contractConfig) {
        setError(`Configuration non disponible pour le réseau ${networkId}`);
        setLoading(false);
        return { isOwner: false, tokenIds: [] };
      }
      
      const { address: contractAddress, apiUrl } = contractConfig;
      
      console.log(`Vérification des NFTs pour l'adresse ${address} sur le contrat ${contractAddress} (réseau: ${networkId})`);
      
      // Utiliser l'API Alchemy pour vérifier la propriété des NFTs
      const alchemyUrl = `${apiUrl}/${alchemyApiKey}/getNFTs?owner=${address}&contractAddresses[]=${contractAddress}`;
      
      console.log(`Requête Alchemy: ${alchemyUrl}`);
      
      const response = await axios.get(alchemyUrl);
      console.log('Réponse Alchemy:', response.data);
      
      // Filtrer les NFTs possédés
      const ownedNFTs = response.data.ownedNfts.filter((nft: any) => nft.balance > 0);
      console.log('NFTs possédés:', ownedNFTs);
      
      let resultIsOwner = false;
      let resultTokenIds: string[] = [];
      
      if (ownedNFTs.length > 0) {
        resultIsOwner = true;
        
        // Extraire les token IDs
        resultTokenIds = ownedNFTs.map((nft: any) => {
          // Convertir le tokenId de hex à décimal si nécessaire
          const tokenId = nft.id.tokenId;
          return tokenId.startsWith('0x') ? parseInt(tokenId, 16).toString() : tokenId;
        });
        
        console.log('Token IDs trouvés:', resultTokenIds);
        setIsOwner(resultIsOwner);
        setTokenIds(resultTokenIds);
      } else {
        console.log('Aucun NFT trouvé pour cette collection');
        setIsOwner(false);
        setTokenIds([]);
      }
      
      setLoading(false);
      return { isOwner: resultIsOwner, tokenIds: resultTokenIds };
    } catch (err) {
      console.error("Erreur lors de la vérification de propriété NFT avec Alchemy:", err);
      setError("Impossible de vérifier la propriété des NFTs. Veuillez réessayer.");
      setIsOwner(false);
      setTokenIds([]);
      setLoading(false);
      return { isOwner: false, tokenIds: [] };
    }
  }, [alchemyApiKey]);

  return { isOwner, tokenIds, loading, error, checkOwnership };
};
