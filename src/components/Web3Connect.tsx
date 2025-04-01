import React, { useState, useEffect } from 'react';
import { Wallet, ChevronDown, LogOut, Check } from 'lucide-react';
import { ethers } from 'ethers';
import { SUPPORTED_CHAINS } from '../hooks/useNFTs';

interface Web3ConnectProps {
  onConnect: (address: string, chainId?: string) => void;
}

// Convertir la liste des réseaux supportés en un format utilisable par le composant
const NETWORKS = SUPPORTED_CHAINS.reduce((acc, chain) => {
  acc[chain.chainId] = { 
    name: chain.name, 
    chainId: parseInt(chain.chainId, 16), 
    color: getNetworkColor(chain.id),
    id: chain.id
  };
  return acc;
}, {} as Record<string, { name: string, chainId: number, color: string, id: string }>);

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

export const Web3Connect: React.FC<Web3ConnectProps> = ({ onConnect }) => {
  const [address, setAddress] = useState<string>('');
  const [manualAddress, setManualAddress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [networkId, setNetworkId] = useState<string>('');
  const [selectedChainId, setSelectedChainId] = useState<string | undefined>(undefined);
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  // Vérifier si MetaMask est installé
  const checkIfWalletIsInstalled = () => {
    const { ethereum } = window as any;
    return Boolean(ethereum);
  };

  // Initialiser le provider ethers
  useEffect(() => {
    const initProvider = async () => {
      try {
        if (checkIfWalletIsInstalled()) {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          
          // Récupérer le réseau actuel
          const network = await provider.getNetwork();
          const chainIdHex = '0x' + network.chainId.toString(16);
          setNetworkId(chainIdHex);
          setSelectedChainId(chainIdHex);
          
          // Vérifier si déjà connecté
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            const address = accounts[0].address;
            setAddress(address);
            setIsConnected(true);
            onConnect(address, chainIdHex);
          }
        }
      } catch (error) {
        console.error('Erreur lors de l\'initialisation du provider:', error);
      }
    };

    initProvider();
  }, [onConnect]);

  // Écouter les changements de compte et de réseau
  useEffect(() => {
    const { ethereum } = window as any;

    if (ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // L'utilisateur s'est déconnecté
          setIsConnected(false);
          setAddress('');
        } else {
          // Mise à jour de l'adresse
          setAddress(accounts[0]);
          setIsConnected(true);
          onConnect(accounts[0], selectedChainId);
        }
      };

      const handleChainChanged = (chainId: string) => {
        setNetworkId(chainId);
        setSelectedChainId(chainId);
        
        // Si l'utilisateur est connecté, mettre à jour la connexion avec le nouveau réseau
        if (isConnected && address) {
          onConnect(address, chainId);
        }
      };

      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);

      return () => {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [onConnect, address, isConnected, selectedChainId]);

  // Connecter au wallet
  const connectWallet = async () => {
    try {
      setError('');

      if (!checkIfWalletIsInstalled()) {
        throw new Error('Aucun wallet compatible Ethereum détecté. Veuillez installer MetaMask ou un autre wallet compatible.');
      }

      // Demander la connexion au wallet via ethereum.request
      const { ethereum } = window as any;
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      
      if (!accounts || accounts.length === 0) {
        throw new Error('Aucun compte trouvé dans le wallet.');
      }

      const userAddress = accounts[0];
      
      if (!ethers.isAddress(userAddress)) {
        throw new Error('Adresse Ethereum invalide');
      }

      // Mettre à jour l'état
      setAddress(userAddress);
      setIsConnected(true);
      
      // Récupérer le réseau actuel
      const provider = new ethers.BrowserProvider(ethereum);
      const network = await provider.getNetwork();
      const chainIdHex = '0x' + network.chainId.toString(16);
      setNetworkId(chainIdHex);
      setSelectedChainId(chainIdHex);
      
      // Notifier le parent
      onConnect(userAddress, chainIdHex);
    } catch (error) {
      console.error('Erreur lors de la connexion au wallet:', error);
      setError(error instanceof Error ? error.message : 'Erreur inconnue');
    }
  };

  // Connecter avec une adresse manuelle
  const connectWithAddress = () => {
    try {
      setError('');

      if (!manualAddress) {
        throw new Error('Veuillez entrer une adresse');
      }

      if (!ethers.isAddress(manualAddress)) {
        throw new Error('Format d\'adresse Ethereum invalide');
      }

      // Vérifier que l'adresse est valide
      const checksumAddress = ethers.getAddress(manualAddress);
      
      if (!checksumAddress) {
        throw new Error('Adresse Ethereum invalide');
      }

      setAddress(checksumAddress);
      setIsConnected(true);
      
      // Notifier le parent avec l'adresse et le réseau sélectionné
      onConnect(checksumAddress, selectedChainId);
    } catch (error) {
      console.error('Erreur lors de la connexion avec adresse manuelle:', error);
      setError(error instanceof Error ? error.message : 'Erreur inconnue');
    }
  };

  // Déconnecter le wallet
  const disconnectWallet = () => {
    setAddress('');
    setIsConnected(false);
    setShowDropdown(false);
    onConnect('', undefined);
  };

  // Obtenir le nom du réseau actuel
  const getNetworkName = () => {
    return networkId && NETWORKS[networkId] 
      ? NETWORKS[networkId].name 
      : networkId 
        ? `Réseau inconnu (${networkId})` 
        : 'Réseau inconnu';
  };

  // Obtenir la couleur du réseau actuel
  const getNetworkColorClass = () => {
    return networkId && NETWORKS[networkId] 
      ? NETWORKS[networkId].color 
      : 'bg-gray-500';
  };

  // Changer de réseau
  const switchNetwork = async (chainId: string) => {
    setSelectedChainId(chainId);
    setShowDropdown(false);
    
    // Si l'utilisateur est connecté, mettre à jour la connexion avec le nouveau réseau
    if (isConnected && address) {
      onConnect(address, chainId);
    }
    
    // Si MetaMask est installé, essayer de changer de réseau
    if (checkIfWalletIsInstalled()) {
      try {
        const { ethereum } = window as any;
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId }],
        });
      } catch (error) {
        console.error('Erreur lors du changement de réseau:', error);
        // On ne bloque pas l'utilisateur si le changement de réseau échoue
        // car il peut toujours utiliser une adresse manuelle
      }
    }
  };

  // Rendu du header compact
  return (
    <header style={{ backgroundColor: '#1D4E51' }} className="flex justify-between items-center h-16 px-4 shadow-md">
      {/* Logo */}
      <div className="flex items-center">
        <img src="/unum.png" alt="Unum Logo" className="h-10" />
      </div>
      
      {/* Erreur */}
      {error && (
        <div className="text-sm text-red-300 mx-4">{error}</div>
      )}
      
      {/* Bouton de connexion ou informations du wallet */}
      <div className="relative">
        {isConnected ? (
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-white"
          >
            <div className={`w-2 h-2 rounded-full ${getNetworkColorClass()}`} />
            <span className="text-sm font-medium">
              {address.substring(0, 6)}...{address.substring(address.length - 4)}
            </span>
            <ChevronDown className="w-4 h-4" />
          </button>
        ) : showManualInput ? (
          <div className="flex items-center">
            <input
              type="text"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="Adresse Ethereum (0x...)"
              className="mr-2 px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            />
            <button
              onClick={connectWithAddress}
              className="px-3 py-1 text-sm bg-white text-[#1D4E51] rounded-md hover:bg-gray-100"
            >
              Connecter
            </button>
            <button
              onClick={() => setShowManualInput(false)}
              className="ml-2 px-3 py-1 text-sm text-white/80 hover:text-white"
            >
              Annuler
            </button>
          </div>
        ) : (
          <div className="flex items-center">
            <button
              onClick={connectWallet}
              className="px-3 py-1.5 bg-white text-[#1D4E51] rounded-md hover:bg-gray-100 flex items-center"
            >
              <Wallet className="w-4 h-4 mr-1.5" />
              <span className="text-sm">Connecter Wallet</span>
            </button>
            <button
              onClick={() => setShowManualInput(true)}
              className="ml-2 text-sm text-white/80 hover:text-white"
            >
              Adresse manuelle
            </button>
          </div>
        )}
        
        {/* Dropdown pour le wallet connecté */}
        {showDropdown && isConnected && (
          <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <div className="p-3 border-b border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Adresse connectée</p>
              <p className="text-xs font-mono break-all">{address}</p>
            </div>
            
            <div className="p-3 border-b border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Réseau actuel</p>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${getNetworkColorClass()}`} />
                <span className="text-sm">{getNetworkName()}</span>
              </div>
            </div>
            
            <div className="p-3 border-b border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Changer de réseau</p>
              <div className="max-h-48 overflow-y-auto">
                {Object.entries(NETWORKS).map(([chainId, network]) => (
                  <button
                    key={chainId}
                    onClick={() => switchNetwork(chainId)}
                    className="w-full flex items-center text-left px-2 py-1.5 hover:bg-gray-100 rounded-md mb-1"
                  >
                    <div className={`w-3 h-3 rounded-full mr-2 ${network.color}`} />
                    <span className="text-sm">{network.name}</span>
                    {chainId === networkId && (
                      <Check className="ml-auto w-4 h-4 text-green-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <button
              onClick={disconnectWallet}
              className="w-full flex items-center text-left p-3 text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span className="text-sm">Déconnecter</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};