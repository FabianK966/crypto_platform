// src/app/services/replay.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  CandleData, 
  ReplayConfig, 
  ReplayResponse,
  IntervalOption 
} from '../models/replay.model';

@Injectable({
  providedIn: 'root'
})
export class ReplayService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/replay';

  getCandles(config: ReplayConfig): Observable<ReplayResponse> {
    return this.http.post<ReplayResponse>(`${this.apiUrl}/candles`, config);
  }

  getAvailableSymbols(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/symbols`);
  }

  getAvailableIntervals(): Observable<IntervalOption[]> {
    return this.http.get<IntervalOption[]>(`${this.apiUrl}/intervals`);
  }

  health(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`);
  }
}