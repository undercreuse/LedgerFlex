import { SVGShape } from '../types';
import { extractShapesFromSVG } from './svgProcessor';

/**
 * Charge un SVG à partir d'un fichier local en fonction du token ID
 * @param tokenId - L'ID du token NFT
 * @returns Promise<SVGShape[]> - Les formes SVG extraites
 */
export const loadSVGByTokenId = async (tokenId: string): Promise<SVGShape[]> => {
  try {
    // Construire le chemin du fichier SVG
    const svgPath = `/svg/mask_${tokenId}.svg`;
    console.log(`Tentative de chargement du SVG depuis: ${svgPath}`);
    
    // Charger le contenu du fichier SVG
    const response = await fetch(svgPath);
    if (!response.ok) {
      console.error(`Erreur HTTP lors du chargement du SVG: ${response.status} ${response.statusText}`);
      throw new Error(`Impossible de charger le SVG pour le token ID ${tokenId} (${response.status} ${response.statusText})`);
    }
    
    const svgContent = await response.text();
    console.log(`SVG chargé avec succès, taille: ${svgContent.length} caractères`);
    
    // Parser le SVG pour extraire les formes
    const shapes = extractShapesFromSVG(svgContent);
    console.log(`Formes extraites: ${shapes.length}`);
    
    if (shapes.length === 0) {
      console.warn("Aucune forme n'a été extraite du SVG");
    }
    
    return shapes;
  } catch (error) {
    console.error("Erreur lors du chargement du SVG:", error);
    
    // Vérifier si l'erreur est liée à un problème de CORS
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error("Possible erreur CORS ou problème de connectivité réseau");
      throw new Error(`Erreur réseau lors du chargement du SVG pour le token ID ${tokenId}. Vérifiez que le fichier existe et est accessible.`);
    }
    
    throw error;
  }
};
