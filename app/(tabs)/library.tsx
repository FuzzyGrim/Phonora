import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Music, Play as Playlist, Download, Clock } from 'lucide-react-native';

export default function LibraryScreen() {
  const { colors } = useTheme();

  const menuItems = [
    { icon: Music, title: 'Songs', count: '0' },
    { icon: Playlist, title: 'Playlists', count: '0' },
    { icon: Download, title: 'Downloads', count: '0' },
    { icon: Clock, title: 'Recently Played', count: '0' },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Library</Text>
      </View>
      <View style={styles.content}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.menuItem, { borderBottomColor: colors.border }]}>
            <View style={styles.menuItemLeft}>
              <item.icon size={24} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                {item.title}
              </Text>
            </View>
            <Text style={[styles.menuItemCount, { color: colors.textSecondary }]}>
              {item.count}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
  },
  content: {
    padding: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    marginLeft: 15,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  menuItemCount: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
});