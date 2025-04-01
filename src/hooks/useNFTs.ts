import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NFTMetadata } from '../types';

const OPENSEA_API_URL = 'https://api.opensea.io/api/v2';
const API_KEY = import.meta.env.VITE_OPENSEA_API_KEY;

export const useNFTs = (address: string) => {
  const [nfts, setNfts] = useState<NFTMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const response = await fetch(
          `${OPENSEA_API_URL}/chain/ethereum/account/${address}/nfts`,
          {
            headers: {
              'accept': 'application/json',
              'x-api-key': API_KEY
            }
          }
        );

        if (!response.ok) {
          throw new Error(`OpenSea API error: ${response.status}`);
        }

        const data = await response.json();
        const nftList: NFTMetadata[] = [];

        // Process each NFT from the OpenSea response
        data.nfts?.forEach((nft: any, index: number) => {
          if (nft.image_url) {
            nftList.push({
              id: index + 1,
              imageUrl: nft.image_url,
              name: nft.name || `NFT #${nft.identifier}`,
              tokenId: nft.identifier
            });
          }
        });

        setNfts(nftList);
        if (nftList.length === 0) {
          setError('No NFTs found for this address');
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
    }
  }, [address]);

  return { nfts, loading, error };
};