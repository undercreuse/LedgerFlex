import React, { useState, useEffect } from 'react';
import { Wallet, ChevronDown } from 'lucide-react';
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
  const [showNetworkSelector, setShowNetworkSelector] = useState<boolean>(false);

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

  // Obtenir le nom du réseau actuel
  const getNetworkName = () => {
    return networkId && NETWORKS[networkId] 
      ? NETWORKS[networkId].name 
      : networkId 
        ? `Réseau inconnu (${networkId})` 
        : 'Réseau inconnu';
  };

  // Obtenir la couleur du réseau actuel
  const getNetworkColor = () => {
    return networkId && NETWORKS[networkId] 
      ? NETWORKS[networkId].color 
      : 'bg-gray-500';
  };

  // Changer de réseau
  const switchNetwork = async (chainId: string) => {
    setSelectedChainId(chainId);
    setShowNetworkSelector(false);
    
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

  return (
    <div className="mb-6 p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Connexion Web3</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {isConnected ? (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Adresse connectée:</p>
              <p className="font-mono text-sm break-all">{address}</p>
            </div>
            
            <div className="flex flex-col items-end">
              <div className="relative">
                <button
                  onClick={() => setShowNetworkSelector(!showNetworkSelector)}
                  className="flex items-center text-sm font-medium px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
                >
                  <div className={`w-3 h-3 rounded-full mr-2 ${getNetworkColor()}`}></div>
                  <span>{getNetworkName()}</span>
                  <ChevronDown className="ml-2 w-4 h-4" />
                </button>
                
                {showNetworkSelector && (
                  <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                    <div className="py-1">
                      {Object.entries(NETWORKS).map(([chainId, network]) => (
                        <button
                          key={chainId}
                          onClick={() => switchNetwork(chainId)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center"
                        >
                          <div className={`w-3 h-3 rounded-full mr-2 ${network.color}`}></div>
                          <span>{network.name}</span>
                          {chainId === networkId && (
                            <span className="ml-auto text-green-500">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-2">
                <div className={`px-2 py-1 rounded-md text-xs font-medium text-white ${getNetworkColor()} inline-block`}>
                  {getNetworkName()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <button
              onClick={connectWallet}
              className="flex items-center justify-center w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Wallet className="mr-2 h-5 w-5" />
              Connecter avec MetaMask
            </button>
          </div>
          
          <div className="flex items-center my-4">
            <div className="flex-grow h-px bg-gray-300"></div>
            <span className="px-3 text-gray-500 text-sm">ou</span>
            <div className="flex-grow h-px bg-gray-300"></div>
          </div>
          
          <div className="mb-2">
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-blue-600 hover:underline text-sm flex items-center"
            >
              {showManualInput ? 'Masquer' : 'Entrer une adresse manuellement'}
              <ChevronDown className={`ml-1 w-4 h-4 transform ${showManualInput ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          {showManualInput && (
            <div className="mt-3">
              <div className="relative">
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Entrer une adresse Ethereum (0x...)"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                
                <div className="mt-3 relative">
                  <button
                    onClick={() => setShowNetworkSelector(!showNetworkSelector)}
                    className="flex items-center text-sm font-medium px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 w-full"
                  >
                    <span>Sélectionner un réseau</span>
                    <ChevronDown className="ml-auto w-4 h-4" />
                  </button>
                  
                  {showNetworkSelector && (
                    <div className="absolute left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-10">
                      <div className="py-1">
                        {Object.entries(NETWORKS).map(([chainId, network]) => (
                          <button
                            key={chainId}
                            onClick={() => switchNetwork(chainId)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center"
                          >
                            <div className={`w-3 h-3 rounded-full mr-2 ${network.color}`}></div>
                            <span>{network.name}</span>
                            {chainId === selectedChainId && (
                              <span className="ml-auto text-green-500">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <button
                onClick={connectWithAddress}
                className="mt-3 w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Connecter
              </button>
            </div>
          )}
          
          {!checkIfWalletIsInstalled() && (
            <div className="mt-4 text-sm text-gray-600">
              <p>
                Aucun wallet compatible Ethereum détecté. Veuillez installer{' '}
                <a
                  href="https://metamask.io/download.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  MetaMask
                </a>{' '}
                ou utiliser l'option "Entrer une adresse manuellement".
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};