package com.example.crypto_platform.repository;

import com.example.crypto_platform.entity.PortfolioAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PortfolioAssetRepository extends JpaRepository<PortfolioAsset, Long> {
    Optional<PortfolioAsset> findBySymbol(String symbol);
}