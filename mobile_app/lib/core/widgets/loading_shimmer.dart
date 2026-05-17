import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

// Sacred-palette shimmer loader with configurable dimensions and border radius
class ShimmerLoader extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const ShimmerLoader({
    super.key,
    this.width = double.infinity,
    this.height = 16.0,
    this.borderRadius = 8.0,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: const Color(0xFFEEE5D8),
      highlightColor: const Color(0xFFFAF6EE),
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

// Backward-compatible alias
class LoadingShimmer extends ShimmerLoader {
  const LoadingShimmer({
    super.key,
    super.width,
    super.height,
    super.borderRadius,
  });
}
