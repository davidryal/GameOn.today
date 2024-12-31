import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import SportSelect from "@/components/SportSelect";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type NewGame } from "@db/schema";
import { useAuth } from "@/components/AuthProvider";

export default function CreateGame() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Redirect to home if not logged in
  if (!user) {
    navigate("/");
    return null;
  }

  const form = useForm<NewGame>({
    defaultValues: {
      title: "",
      location: "",
      date: "",
      playerThreshold: 10,
      sportId: undefined,
      creatorId: user.uid,
      creatorName: user.displayName || "",
    },
  });

  const createGame = useMutation({
    mutationFn: async (values: NewGame) => {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to create game");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      toast({
        title: "Success",
        description: "Game created successfully",
      });
      navigate("/");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 border-b">
        <div className="container flex items-center">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold ml-4">Create New Game</h1>
        </div>
      </header>

      <main className="container py-6">
        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createGame.mutate(data))} className="space-y-6">
                <FormField
                  control={form.control}
                  name="sportId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sport</FormLabel>
                      <SportSelect {...field} />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Game title..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Game location..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date & Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="playerThreshold"
                  render={({ field: { onChange, ...field } }) => (
                    <FormItem>
                      <FormLabel>Player Threshold</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="2"
                          onChange={(e) => onChange(parseInt(e.target.value, 10))}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={createGame.isPending}>
                  Create Game
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}