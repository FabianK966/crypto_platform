package com.example.crypto_platform.repository;

import com.example.crypto_platform.entity.MarketPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MarketPriceRepository extends JpaRepository<MarketPrice, Long> {
    Optional<MarketPrice> findBySymbol(String symbol);
}