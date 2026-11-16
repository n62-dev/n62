#!/usr/bin/perl
# SPDX-License-Identifier: GPL-3.0-or-later
# ca hunter probe (night review 2026-11-16): app/scripts/text-rules.ts TEXT_LINE's patterns (P20's ratchet), counted per
# top folder of src/ for every folder, not only TEXT_DIRS (src/engine, src/units). Comments and *.test.ts / *.spec.ts
# left out, as text-rules.ts does. No node (runs while host-cpu is held).
#   perl ca-textlines.pl <app dir> [--files=<folder>]   (per-file counts for one folder)
use strict; use warnings;
use File::Find;
my $app = shift; my $only;
for (@ARGV) { $only = $1 if /^--files=(.*)/ }
my @pat = (
  qr/\.(?:match|matchAll)\(/,
  qr/\.(?:replace|replaceAll|split|search)\(\s*\//,
  qr/\.(?:test|exec)\(/,
  qr/new RegExp\(/,
  qr/\.(?:indexOf|lastIndexOf)\(\s*["'`]/,
  qr/\b(?:depth|level|nest|parens?)\s*(?:\+\+|--|\+=\s*1|-=\s*1)/,
  qr/(?:\+\+|--)\s*(?:depth|level|nest|parens?)\b/,
  qr/===?\s*["'][()[\]{}]["']/,
);
my (%dir, %file);
find({ no_chdir => 1, wanted => sub {
  my $f = $File::Find::name;
  return unless -f $f && $f =~ /\.(ts|svelte)$/ && $f !~ /\.(test|spec)\.ts$/;
  (my $rel = $f) =~ s{^\Q$app\E/src/}{};
  my $top = $rel =~ m{^([^/]+)/} ? $1 : ".";
  open my $h, "<", $f or return;
  my $n = 0;
  while (my $l = <$h>) { next if $l =~ m{^\s*(//|\*|/\*)}; $n++ if grep { $l =~ $_ } @pat }
  close $h;
  $dir{$top} += $n; $file{$rel} = $n if $n;
} }, "$app/src");
if ($only) { printf "%5d  %s\n", $file{$_}, $_ for sort { $file{$b} <=> $file{$a} } grep { m{^\Q$only\E/} } keys %file; exit }
printf "%5d  %s\n", $dir{$_}, $_ for sort { $dir{$b} <=> $dir{$a} } keys %dir;
