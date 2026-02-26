package com.example.crypto_platform.service;

import com.example.crypto_platform.dto.ReplaySaveRequestDto;
import com.example.crypto_platform.dto.ReplaySessionResponseDto;
import com.example.crypto_platform.entity.ReplaySession;
import com.example.crypto_platform.repository.ReplaySessionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service zum Speichern und Abrufen von Replay-Sessions.
 * Jeder Speichervorgang erhält eine neue UUID → Sessions sind immer eindeutig
 * unterscheidbar, auch wenn Symbol/Intervall identisch sind.
 */
@Service
@RequiredArgsConstructor
public class ReplaySessionService {

    private final ReplaySessionRepository repository;
    private final ObjectMapper objectMapper = new ObjectMapper();   // direkt instanziiert

    /**
     * Speichert den aktuellen Replay-Zustand als neue Session.
     * Gibt immer eine frische UUID zurück – kein Überschreiben alter Sessions.
     */
    public ReplaySessionResponseDto saveSession(ReplaySaveRequestDto dto) {

        // Historien als JSON serialisieren
        String tradeHistoryJson = toJson(dto.getTradeHistory());
        String depositHistoryJson = toJson(dto.getDepositHistory());

        int tradeCount = dto.getTradeHistory() != null ? dto.getTradeHistory().size() : 0;

        ReplaySession session = ReplaySession.builder()
                .id(UUID.randomUUID().toString())           // IMMER neue UUID
                .createdAt(LocalDateTime.now())

                // Konfiguration
                .symbol(dto.getSymbol() != null ? dto.getSymbol().toUpperCase() : "UNKNOWN")
                .intervalValue(dto.getIntervalValue())
                .startTime(dto.getStartTime())
                .endTime(dto.getEndTime())
                .leverage(dto.getLeverage() != null ? dto.getLeverage() : 1)

                // Portfolio
                .initialBalance(orZero(dto.getInitialBalance()))
                .startBalance(orZero(dto.getStartBalance()))
                .finalCashBalance(orZero(dto.getFinalCashBalance()))
                .totalBalance(orZero(dto.getTotalBalance()))
                .realizedPnl(orZero(dto.getRealizedPnl()))
                .totalFees(orZero(dto.getTotalFees()))

                // Positionen
                .longQuantity(orZero(dto.getLongQuantity()))
                .longAvgPrice(orZero(dto.getLongAvgPrice()))
                .longDebt(orZero(dto.getLongDebt()))
                .shortQuantity(orZero(dto.getShortQuantity()))
                .shortAvgPrice(orZero(dto.getShortAvgPrice()))

                // Fortschritt
                .currentCandle(dto.getCurrentCandle() != null ? dto.getCurrentCandle() : 0)
                .totalCandles(dto.getTotalCandles() != null ? dto.getTotalCandles() : 0)
                .tradeCount(tradeCount)

                // Historien
                .tradeHistory(tradeHistoryJson)
                .depositHistory(depositHistoryJson)
                .build();

        ReplaySession saved = repository.save(session);

        System.out.println("✅ Replay-Session gespeichert: " + saved.getId()
                + " | " + saved.getSymbol()
                + " | Trades: " + tradeCount);

        return toResponseDto(saved);
    }

    /** Alle gespeicherten Sessions (neueste zuerst). */
    public List<ReplaySessionResponseDto> getAllSessions() {
        return repository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponseDto)
                .collect(Collectors.toList());
    }

    /** Eine Session per ID laden. */
    public ReplaySessionResponseDto getSessionById(String id) {
        return repository.findById(id)
                .map(this::toResponseDto)
                .orElseThrow(() -> new IllegalArgumentException("Session nicht gefunden: " + id));
    }

    /** Session löschen. */
    public void deleteSession(String id) {
        if (!repository.existsById(id)) {
            throw new IllegalArgumentException("Session nicht gefunden: " + id);
        }
        repository.deleteById(id);
    }

    // ----------------------------------------------------------------
    // Hilfsmethoden
    // ----------------------------------------------------------------

    private ReplaySessionResponseDto toResponseDto(ReplaySession s) {
        return ReplaySessionResponseDto.builder()
                .id(s.getId())
                .createdAt(s.getCreatedAt())
                .symbol(s.getSymbol())
                .intervalValue(s.getIntervalValue())
                .startTime(s.getStartTime())
                .endTime(s.getEndTime())
                .leverage(s.getLeverage())
                .initialBalance(s.getInitialBalance())
                .startBalance(s.getStartBalance())
                .finalCashBalance(s.getFinalCashBalance())
                .totalBalance(s.getTotalBalance())
                .realizedPnl(s.getRealizedPnl())
                .totalFees(s.getTotalFees())
                .longQuantity(s.getLongQuantity())
                .longAvgPrice(s.getLongAvgPrice())
                .shortQuantity(s.getShortQuantity())
                .shortAvgPrice(s.getShortAvgPrice())
                .currentCandle(s.getCurrentCandle())
                .totalCandles(s.getTotalCandles())
                .tradeCount(s.getTradeCount())
                .build();
    }

    private String toJson(Object obj) {
        if (obj == null) return "[]";
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            System.err.println("⚠️ JSON-Serialisierung fehlgeschlagen: " + e.getMessage());
            return "[]";
        }
    }

    private BigDecimal orZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }
}