import React, { useState, useEffect } from 'react';
import { Wallet, ChevronDown } from 'lucide-react';
import { ethers } from 'ethers';

interface Web3ConnectProps {
  onConnect: (address: string) => void;
}

// Liste des réseaux Ethereum avec leurs IDs
const NETWORKS: Record<string, { name: string, chainId: number, color: string }> = {
  '0x1': { name: 'Ethereum Mainnet', chainId: 1, color: 'bg-blue-500' },
  '0x5': { name: 'Goerli Testnet', chainId: 5, color: 'bg-purple-500' },
  '0xaa36a7': { name: 'Sepolia Testnet', chainId: 11155111, color: 'bg-green-500' },
  '0x89': { name: 'Polygon', chainId: 137, color: 'bg-indigo-500' },
  '0x13881': { name: 'Mumbai Testnet', chainId: 80001, color: 'bg-pink-500' },
  '0xa': { name: 'Optimism', chainId: 10, color: 'bg-red-500' },
  '0xa4b1': { name: 'Arbitrum One', chainId: 42161, color: 'bg-yellow-500' },
};

export const Web3Connect: React.FC<Web3ConnectProps> = ({ onConnect }) => {
  const [address, setAddress] = useState<string>('');
  const [manualAddress, setManualAddress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [networkId, setNetworkId] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

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
          setProvider(provider);
          
          // Récupérer le réseau actuel
          const network = await provider.getNetwork();
          setNetworkId('0x' + network.chainId.toString(16));
          
          // Vérifier si déjà connecté
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            const address = accounts[0].address;
            setAddress(address);
            setIsConnected(true);
            onConnect(address);
          }
        }
      } catch (err) {
        console.error("Erreur lors de l'initialisation du provider:", err);
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
          // Déconnecté
          setIsConnected(false);
          setAddress('');
        } else if (accounts[0] !== address) {
          // Changement de compte
          setAddress(accounts[0]);
          setIsConnected(true);
          onConnect(accounts[0]);
        }
      };

      const handleChainChanged = (chainId: string) => {
        setNetworkId(chainId);
        // Recharger la page est recommandé par MetaMask lors d'un changement de réseau
        // window.location.reload();
      };

      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [address, onConnect]);

  const connectWallet = async () => {
    try {
      setError('');
      
      if (!checkIfWalletIsInstalled()) {
        throw new Error('Aucun wallet compatible Ethereum détecté. Veuillez installer MetaMask ou un autre wallet compatible.');
      }
      
      // Demander la connexion au wallet via ethereum.request
      const { ethereum } = window as any;
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length === 0) {
        throw new Error('Aucun compte autorisé');
      }
      
      const connectedAddress = accounts[0];
      
      // Valider l'adresse
      const isValid = ethers.isAddress(connectedAddress);
      if (!isValid) {
        throw new Error('Adresse Ethereum invalide');
      }
      
      // Initialiser le provider après la connexion
      const newProvider = new ethers.BrowserProvider(ethereum);
      setProvider(newProvider);
      
      // Récupérer le réseau actuel
      const network = await newProvider.getNetwork();
      setNetworkId('0x' + network.chainId.toString(16));
      
      setAddress(connectedAddress);
      setIsConnected(true);
      onConnect(connectedAddress);
    } catch (err) {
      console.error('Erreur de connexion:', err);
      setError(err instanceof Error ? err.message : 'Échec de la connexion au wallet');
    }
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setAddress('');
  };

  const handleManualConnect = async () => {
    try {
      setError('');
      
      if (!manualAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('Format d\'adresse Ethereum invalide');
      }
      
      // Valider l'adresse
      const isValid = ethers.isAddress(manualAddress);
      if (!isValid) {
        throw new Error('Adresse Ethereum invalide');
      }
      
      setAddress(manualAddress);
      setIsConnected(true);
      onConnect(manualAddress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la connexion au wallet');
    }
  };

  // Obtenir le nom du réseau actuel
  const getNetworkName = () => {
    return networkId && NETWORKS[networkId] 
      ? NETWORKS[networkId].name 
      : networkId 
        ? `Réseau inconnu (${networkId})` 
        : 'Réseau non détecté';
  };

  // Obtenir la couleur du réseau actuel
  const getNetworkColor = () => {
    return networkId && NETWORKS[networkId] 
      ? NETWORKS[networkId].color 
      : 'bg-gray-500';
  };

  return (
    <div className="w-full">
      {/* Header avec informations de connexion */}
      {isConnected && (
        <div className="w-full bg-white p-3 flex justify-between items-center">
          <div className="flex items-center">
            <h2 className="text-lg font-semibold">LedgerStax</h2>
          </div>
          
          <div className="relative group">
            <div className="flex items-center cursor-pointer">
              <div className="bg-blue-100 p-1.5 rounded-full mr-2">
                <Wallet className="w-4 h-4 text-blue-500" />
              </div>
              <span className="text-sm font-mono">
                {address.substring(0, 6)}...{address.substring(address.length - 4)}
              </span>
            </div>
            
            {/* Dropdown au survol */}
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg overflow-hidden z-20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300">
              <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs text-gray-500">Adresse complète</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(address)}
                    className="text-blue-500 hover:text-blue-700 text-xs"
                    title="Copier l'adresse"
                  >
                    Copier
                  </button>
                </div>
                <p className="text-xs font-mono break-all mb-3">{address}</p>
                
                <div className="mb-3">
                  <span className="text-xs text-gray-500 block mb-1">Réseau</span>
                  <div className={`px-2 py-1 rounded-md text-xs font-medium text-white ${getNetworkColor()} inline-block`}>
                    {getNetworkName()}
                  </div>
                </div>
                
                <button 
                  onClick={disconnectWallet}
                  className="w-full px-3 py-1.5 border border-red-300 text-red-500 text-sm rounded-md hover:bg-red-50 transition-colors duration-200 focus:outline-none"
                >
                  Déconnecter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire de connexion - affiché uniquement si non connecté */}
      {!isConnected && (
        <div className="w-full max-w-md p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold">Connecter un Wallet</h2>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-4">
              <button
                onClick={connectWallet}
                className="w-full px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Connecter avec MetaMask
              </button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">ou</span>
                </div>
              </div>
              
              <button
                onClick={() => setShowManualInput(!showManualInput)}
                className="w-full flex items-center justify-center px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                <span>Saisir une adresse manuellement</span>
                <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showManualInput ? 'rotate-180' : ''}`} />
              </button>
              
              {showManualInput && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Entrer une adresse Ethereum (0x...)"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleManualConnect}
                    className="w-full px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Connecter
                  </button>
                </div>
              )}
            </div>
            
            {!checkIfWalletIsInstalled() && !isConnected && !showManualInput && (
              <p className="text-amber-600 text-sm">
                Aucun wallet compatible Ethereum détecté. Veuillez installer{' '}
                <a 
                  href="https://metamask.io/download/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline"
                >
                  MetaMask
                </a>{' '}
                ou un autre wallet compatible, ou saisir une adresse manuellement.
              </p>
            )}
            
            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};