#!/usr/bin/perl
# SPDX-License-Identifier: GPL-3.0-or-later
# ca hunter probe (night review 2026-11-14): the start chunk's static value-import graph from the sources, no build.
#   perl ca-start-reach.pl <app dir> [entry=main.ts] [--why=<rel>] [--sub=<rel>]
# Same reading as app/scripts/import-rules.ts startReach (import/export ... from, bare import; `import type` and
# braces of only `type` names are erased; import() is lazy). Prints per module: source bytes with comments stripped,
# that text gzipped alone (gzip -9 via IO::Compress if present, else 0), and the importer that first pulls it in.
# --sub=<rel>: the bytes reached ONLY through <rel> (removing that one module from the graph drops them): what a lazy
# import of <rel> would move out of the start chunk (source estimate).
use strict; use warnings;
use File::Basename qw(dirname); use File::Spec;
my $app = shift; my $entry = "main.ts"; my ($why, $sub);
for (@ARGV) { if (/^--why=(.*)/) { $why = $1 } elsif (/^--sub=(.*)/) { $sub = $1 } else { $entry = $_ } }
my $src = "$app/src";
my $gz = eval { require IO::Compress::Gzip; 1 };
sub slurp { my $f = shift; open my $h, "<", $f or return ""; local $/; my $t = <$h>; close $h; $t }
sub strip { my $t = shift; $t =~ s{/\*.*?\*/}{}gs; $t =~ s{(^|[^:"'`\\])//[^\n]*}{$1}g; $t }
sub norm { my $p = shift; my @o; for (split m{/}, $p) { next if $_ eq "." || $_ eq ""; if ($_ eq "..") { pop @o } else { push @o, $_ } } join "/", @o }
sub resolve_spec { my ($from, $spec) = @_; return undef unless $spec =~ /^\./; my $b = norm(dirname($from) . "/" . $spec);
  for my $c ($b, "$b.ts", "$b/index.ts") { return $c if -f "$src/$c" } undef }
sub imports { my $f = shift; my $t = slurp("$src/$f");
  if ($f =~ /\.svelte$/) { my @s = $t =~ m{<script[^>]*>(.*?)</script>}gs; $t = join "\n", @s }
  $t = strip($t); my @out;
  while ($t =~ m{^[ \t]*(import|export)\s+(type\s+)?([^'";]*?)\s*from\s*["']([^"']+)["']}gm) {
    my ($kw, $ty, $cl, $sp) = ($1, $2, $3, $4); next if $ty;
    if ($cl =~ /^\s*\{([^}]*)\}\s*$/) { my @n = grep { /\S/ } map { s/^\s+|\s+$//gr } split /,/, $1; next if @n && !grep { !/^type\s/ } @n }
    push @out, $sp }
  while ($t =~ m{^[ \t]*import\s*["']([^"']+)["']}gm) { push @out, $1 }
  @out }
sub walk { my ($skip) = @_; my %par = ($entry => ""); my @q = ($entry); my %pk;
  while (@q) { my $f = shift @q; next if $f =~ /\.(css|json|md)$/;
    for my $sp (imports($f)) { if ($sp !~ /^\./) { $pk{$sp} //= $f; next } next if $sp =~ /\.css$|\?/;
      my $r = resolve_spec($f, $sp); next unless defined $r; next if defined $skip && $r eq $skip; next if exists $par{$r};
      $par{$r} = $f; push @q, $r } }
  (\%par, \%pk) }
sub size { my $f = shift; my $s = strip(slurp("$src/$f")); my $z = 0;
  if ($gz) { my $o; IO::Compress::Gzip::gzip(\$s => \$o, -Level => 9); $z = length $o } (length($s), $z) }
my ($par, $pk) = walk(undef);
my @rows = map { my ($s, $z) = size($_); [$_, $s, $z, $par->{$_}] } keys %$par;
my ($S, $Z) = (0, 0); $S += $_->[1], $Z += $_->[2] for @rows;
printf "modules %d, stripped source %d B, per-file gzip sum %d B\npackages: %s\n", scalar @rows, $S, $Z, join ", ", map { "$_ (via $pk->{$_})" } sort keys %$pk;
if (defined $why) { my @c; my $f = $why; while (defined $f && $f ne "") { push @c, $f; $f = $par->{$f} } print "why: ", join(" <- ", @c), "\n" }
if (defined $sub) { my ($p2) = walk($sub); my @gone = grep { !exists $p2->{$_} } keys %$par; my ($s, $z) = (0, 0);
  for (@gone) { my ($a, $b) = size($_); $s += $a; $z += $b }
  printf "only through %s: %d modules, stripped %d B, per-file gzip sum %d B\n  %s\n", $sub, scalar @gone, $s, $z, join " ", sort @gone; exit 0 }
my %dir; for (@rows) { (my $d = $_->[0]) =~ s{/[^/]*$}{}; $d = "." if $d eq $_->[0]; $dir{$d}[0]++; $dir{$d}[1] += $_->[1] }
printf "%8d %4d  %s\n", $dir{$_}[1], $dir{$_}[0], $_ for sort { $dir{$b}[1] <=> $dir{$a}[1] } keys %dir;
printf "%7d %6d  %s  <- %s\n", $_->[1], $_->[2], $_->[0], $_->[3] for (sort { $b->[1] <=> $a->[1] } @rows)[0 .. 69];
