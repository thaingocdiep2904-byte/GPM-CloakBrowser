import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Profile, type ProfileCreateData } from "../lib/api";

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Pause polling while a mutation (delete/bulk) is in progress
  const isPaused = useRef(false);

  const refresh = useCallback(async () => {
    if (isPaused.current) return;
    try {
      const data = await api.listProfiles();
      setProfiles(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Poll for status changes every 3 seconds
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const create = useCallback(
    async (data: ProfileCreateData): Promise<Profile | undefined> => {
      try {
        const profile = await api.createProfile(data);
        setProfiles((prev) => [profile, ...prev]);
        return profile;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create profile");
      }
    },
    [],
  );

  const update = useCallback(
    async (id: string, data: Partial<ProfileCreateData>) => {
      try {
        const profile = await api.updateProfile(id, data);
        setProfiles((prev) => prev.map((p) => (p.id === id ? profile : p)));
        return profile;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update profile");
      }
    },
    [],
  );

  const remove = useCallback(
    async (id: string) => {
      // Pause polling to prevent race condition
      isPaused.current = true;
      // Optimistic update: remove from UI immediately
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      try {
        await api.deleteProfile(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete profile");
        // Restore list on failure
        try {
          const data = await api.listProfiles();
          setProfiles(data);
        } catch {
          // ignore secondary error
        }
      } finally {
        isPaused.current = false;
        // Sync with server after deletion
        try {
          const data = await api.listProfiles();
          setProfiles(data);
        } catch {
          // ignore
        }
      }
    },
    [],
  );

  const launch = useCallback(
    async (id: string) => {
      try {
        const result = await api.launchProfile(id);
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to launch profile");
      }
    },
    [refresh],
  );

  const stop = useCallback(
    async (id: string) => {
      try {
        await api.stopProfile(id);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to stop profile");
      }
    },
    [refresh],
  );

  const bulkLaunch = useCallback(
    async (ids: string[]) => {
      try {
        const result = await api.bulkLaunchProfiles(ids);
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to bulk launch profiles");
      }
    },
    [refresh],
  );

  const bulkStop = useCallback(
    async (ids: string[]) => {
      try {
        const result = await api.bulkStopProfiles(ids);
        await refresh();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to bulk stop profiles");
      }
    },
    [refresh],
  );

  const bulkDelete = useCallback(
    async (ids: string[]) => {
      // Pause polling during bulk delete
      isPaused.current = true;
      // Optimistic: remove selected profiles immediately
      setProfiles((prev) => prev.filter((p) => !ids.includes(p.id)));
      try {
        const result = await api.bulkDeleteProfiles(ids);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to bulk delete profiles");
      } finally {
        isPaused.current = false;
        try {
          const data = await api.listProfiles();
          setProfiles(data);
        } catch {
          // ignore
        }
      }
    },
    [],
  );

  const bulkCreate = useCallback(
    async (data: Parameters<typeof api.bulkCreateProfiles>[0]) => {
      try {
        const newProfiles = await api.bulkCreateProfiles(data);
        setProfiles((prev) => [...newProfiles, ...prev]);
        return newProfiles;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to bulk create profiles");
      }
    },
    [],
  );

  return { profiles, loading, error, refresh, create, update, remove, launch, stop, bulkLaunch, bulkStop, bulkDelete, bulkCreate };
}
