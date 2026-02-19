
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  PortfolioAssetDto, 
  PortfolioSummaryDto,
  AccountDto,
  BuyRequestDto, 
  SellRequestDto, 
  TransactionResponseDto,
  BalanceOperationDto
} from '../models/portfolio.model';

@Injectable({
  providedIn: 'root'
})
export class PortfolioService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/portfolio';
  private accountUrl = 'http://localhost:8080/api/account';

  // Portfolio Endpoints
  getPortfolio(): Observable<PortfolioAssetDto[]> {
    return this.http.get<PortfolioAssetDto[]>(this.apiUrl);
  }

  getPortfolioSummary(): Observable<PortfolioSummaryDto> {
    return this.http.get<PortfolioSummaryDto>(`${this.apiUrl}/summary`);
  }

  getAsset(symbol: string): Observable<PortfolioAssetDto> {
    return this.http.get<PortfolioAssetDto>(`${this.apiUrl}/${symbol}`);
  }

  buyAsset(request: BuyRequestDto): Observable<TransactionResponseDto> {
    return this.http.post<TransactionResponseDto>(`${this.apiUrl}/buy`, request);
  }

  sellAsset(request: SellRequestDto): Observable<TransactionResponseDto> {
    return this.http.post<TransactionResponseDto>(`${this.apiUrl}/sell`, request);
  }

  deleteAsset(symbol: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${symbol}`);
  }

  createAsset(request: BuyRequestDto): Observable<TransactionResponseDto> {
    return this.http.post<TransactionResponseDto>(`${this.apiUrl}/buy`, request);
  }

  // Account / Balance Endpoints
  getAccount(): Observable<AccountDto> {
    return this.http.get<AccountDto>(this.accountUrl);
  }

  depositMoney(amount: number): Observable<AccountDto> {
    const params = new HttpParams().set('amount', amount.toString());
    return this.http.post<AccountDto>(`${this.accountUrl}/deposit`, null, { params });
  }

  withdrawMoney(amount: number): Observable<AccountDto> {
    const params = new HttpParams().set('amount', amount.toString());
    return this.http.post<AccountDto>(`${this.accountUrl}/withdraw`, null, { params });
  }

  setInitialBalance(amount: number): Observable<AccountDto> {
    const params = new HttpParams().set('amount', amount.toString());
    return this.http.put<AccountDto>(`${this.accountUrl}/balance`, null, { params });
  }
}