#!/usr/bin/perl
# SPDX-License-Identifier: GPL-3.0-or-later
# ca hunter probe (night review 2026-11-14): strongly connected sets of value imports in app/src (tests left out),
# the same reading as ca-start-reach.pl (import type and all-type braces erased). perl ca-scc.pl <app dir>
use strict; use warnings; use File::Find; use File::Basename qw(dirname);
my $src = shift() . "/src"; my @files;
find(sub { my $p = $File::Find::name; $File::Find::prune = 1 if $_ eq "_gen"; push @files, substr($p, length($src) + 1) if /\.(ts|svelte)$/ && !/\.test\./ && !/\.d\.ts$/ }, $src);
my %known = map { $_ => 1 } @files;
sub slurp { open my $h, "<", "$src/$_[0]" or return ""; local $/; <$h> }
sub norm { my @o; for (split m{/}, shift) { next if $_ eq "." || $_ eq ""; if ($_ eq "..") { pop @o } else { push @o, $_ } } join "/", @o }
my %g;
for my $f (@files) { my $t = slurp($f); if ($f =~ /\.svelte$/) { $t = join "\n", $t =~ m{<script[^>]*>(.*?)</script>}gs }
  $t =~ s{/\*.*?\*/}{}gs; $t =~ s{(^|[^:"'`\\])//[^\n]*}{$1}g;
  while ($t =~ m{^[ \t]*(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*["'](\.[^"']+)["']}gm) { my ($ty, $cl, $sp) = ($1, $2, $3); next if $ty;
    if ($cl =~ /^\s*\{([^}]*)\}\s*$/) { my @n = grep { /\S/ } map { s/^\s+|\s+$//gr } split /,/, $1; next if @n && !grep { !/^type\s/ } @n }
    my $b = norm(dirname($f) . "/" . $sp); for my $c ($b, "$b.ts", "$b/index.ts") { if ($known{$c}) { push @{$g{$f}}, $c; last } } }
  while ($t =~ m{^[ \t]*import\s*["'](\.[^"']+)["']}gm) { my $b = norm(dirname($f) . "/" . $1); for my $c ($b, "$b.ts") { if ($known{$c}) { push @{$g{$f}}, $c; last } } } }
my ($i, %idx, %low, %on, @st, @out) = (0);
sub sc { my $v = shift; $idx{$v} = $low{$v} = $i++; push @st, $v; $on{$v} = 1;
  for my $w (@{$g{$v} // []}) { if (!exists $idx{$w}) { sc($w); $low{$v} = $low{$w} if $low{$w} < $low{$v} } elsif ($on{$w}) { $low{$v} = $idx{$w} if $idx{$w} < $low{$v} } }
  if ($low{$v} == $idx{$v}) { my @c; while (1) { my $w = pop @st; $on{$w} = 0; push @c, $w; last if $w eq $v } push @out, [sort @c] if @c > 1 } }
no warnings 'recursion'; sc($_) for grep { !exists $idx{$_} } sort @files;
printf "%d files, %d strongly connected sets of value imports\n", scalar @files, scalar @out; print "  ", join(" ", @$_), "\n" for @out;
