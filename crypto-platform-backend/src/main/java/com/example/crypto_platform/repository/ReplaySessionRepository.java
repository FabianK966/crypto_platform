package com.example.crypto_platform.repository;

import com.example.crypto_platform.entity.ReplaySession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository für ReplaySession-Entities.
 * Nutzt JpaRepository – keine custom Queries nötig für den Basis-Use-Case.
 */
@Repository
public interface ReplaySessionRepository extends JpaRepository<ReplaySession, String> {

    /** Alle Sessions nach Erstellungszeitpunkt absteigend (neueste zuerst). */
    List<ReplaySession> findAllByOrderByCreatedAtDesc();

    /** Alle Sessions für ein bestimmtes Symbol. */
    List<ReplaySession> findBySymbolOrderByCreatedAtDesc(String symbol);
}
