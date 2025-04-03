import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { SUPPORTED_CHAINS } from './useNFTs';

interface NetworkInfo {
  id: string;
  name: string;
  chainId: string;
  color: string;
}

interface UseNetworksResult {
  networks: NetworkInfo[];
  selectedNetwork: NetworkInfo | null;
  setSelectedNetwork: (network: NetworkInfo) => void;
  loading: boolean;
  error: string | null;
}

// Fonction pour attribuer une couleur à chaque réseau (reprise de Web3Connect)
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

export const useNetworks = (): UseNetworksResult => {
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Récupérer les réseaux disponibles
  const fetchNetworks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Vérifier si MetaMask est installé
      const { ethereum } = window as any;
      if (ethereum) {
        // Récupérer le réseau actuel
        const provider = new ethers.BrowserProvider(ethereum);
        const network = await provider.getNetwork();
        const chainIdHex = `0x${network.chainId.toString()}`;

        // Convertir la liste des réseaux supportés en NetworkInfo
        const availableNetworks: NetworkInfo[] = SUPPORTED_CHAINS.map(chain => ({
          id: chain.id,
          name: chain.name,
          chainId: chain.chainId,
          color: getNetworkColor(chain.id)
        }));

        setNetworks(availableNetworks);
        
        // Définir le réseau actuel comme réseau sélectionné par défaut
        const currentNetwork = availableNetworks.find(n => n.chainId === chainIdHex) || availableNetworks[0];
        if (!selectedNetwork) {
          setSelectedNetwork(currentNetwork);
        }
      } else {
        // Si MetaMask n'est pas installé, utiliser la liste des réseaux supportés
        const availableNetworks: NetworkInfo[] = SUPPORTED_CHAINS.map(chain => ({
          id: chain.id,
          name: chain.name,
          chainId: chain.chainId,
          color: getNetworkColor(chain.id)
        }));
        
        setNetworks(availableNetworks);
        if (!selectedNetwork && availableNetworks.length > 0) {
          setSelectedNetwork(availableNetworks[0]);
        }
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Erreur lors de la récupération des réseaux:', err);
      setError('Impossible de récupérer les réseaux disponibles');
      setLoading(false);
    }
  }, [selectedNetwork]);

  // Effet pour récupérer les réseaux au chargement
  useEffect(() => {
    fetchNetworks();
  }, [fetchNetworks]);

  // Effet pour mettre à jour les réseaux lorsque le réseau change dans MetaMask
  useEffect(() => {
    const { ethereum } = window as any;
    if (ethereum) {
      const handleChainChanged = () => {
        window.location.reload();
      };
      
      ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  return {
    networks,
    selectedNetwork,
    setSelectedNetwork,
    loading,
    error,
  };
};
