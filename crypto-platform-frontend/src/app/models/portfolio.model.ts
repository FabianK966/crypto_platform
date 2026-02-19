// src/app/models/portfolio.model.ts

export interface PortfolioAssetDto {
  id: number;
  symbol: string;
  quantity: number;
  avgBuyPriceEur: number;
  avgBuyPriceUsd: number;
  currentPriceUsd: number;
  currentValueUsd: number;
  profitLossUsd: number;
  profitLossPercent: number;
  totalRealizedProfit: number;
}

export interface PortfolioSummaryDto {
  initialBalance: number;     
  totalAssetValue: number;      
  totalBalance: number;          
  totalRealizedProfit: number;   
  totalUnrealizedProfit: number; 
  assets: PortfolioAssetDto[];
}

export interface AccountDto {
  id: number;
  initialBalance: number;
  totalRealizedProfit: number;
  createdAt: string;
  updatedAt: string;
}

export interface BuyRequestDto {
  symbol: string;
  quantity: number;
  pricePerCoin: number;
}

export interface SellRequestDto {
  symbol: string;
  quantity: number;
  pricePerCoin: number;
}

export interface TransactionResponseDto {
  symbol: string;
  newBalance: number;
  realizedProfit: number;
  newQuantity: number;
  avgBuyPrice: number;
}

export interface BalanceOperationDto {
  amount: number;
}