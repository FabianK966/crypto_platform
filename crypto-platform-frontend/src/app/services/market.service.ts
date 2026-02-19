import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MarketPrice } from '../models/markets.model';

@Injectable({
  providedIn: 'root'
})
export class MarketService {
  private readonly API_URL = 'http://localhost:8080/api/market';

  constructor(private http: HttpClient) {}

  getPrices(symbols: string[]): Observable<MarketPrice[]> {
    const params = new HttpParams({
      fromObject: { symbols: symbols.join(',') }
    });
    return this.http.get<MarketPrice[]>(`${this.API_URL}/prices`, { params });
  }
}