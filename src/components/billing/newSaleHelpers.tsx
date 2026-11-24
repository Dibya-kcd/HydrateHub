import React, { useState } from 'react';
import { Product } from '../../types';
import { volumeFromName } from '../../utils/billing';
import { PackIcon } from '../common/PackIcon';

export const getProductDefaultPrice = (p: Product): number => {
  if (typeof p.retail === 'number' && !isNaN(p.retail) && p.retail > 0) return p.retail;
  if (typeof p.wholesale === 'number' && !isNaN(p.wholesale) && p.wholesale > 0) return p.wholesale;
  if (typeof (p as any).price === 'number' && !isNaN((p as any).price) && (p as any).price > 0) return (p as any).price;
  return 0;
};

export const sizeOfProduct = (p: { volume?: number; name?: string }): number => {
  const v = Number(p.volume);
  return v > 0 ? v : (p.name ? volumeFromName(p.name) || 0 : 0);
};

export const isSodaProduct = (p: { category?: string; name?: string }): boolean =>
  p.category === 'vibe' || /soda|cola|carbonat/i.test(`${p.category || ''} ${p.name || ''}`);

export const formatInr = (n: number): string =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;


export const ProductCardMedia: React.FC<{ product: Product }> = ({ product }) => {
  const imgSrc = (product as any).imageUrl || (product as any).image;
  const [failed, setFailed] = useState(false);
  if (imgSrc && !failed) {
    return (
      <img
        src={imgSrc}
        alt={product.name}
        className="rt-prod-media__img"
        onError={() => setFailed(true)}
      />
    );
  }
  return <PackIcon pack={product.pack} name={product.name} />;
};
