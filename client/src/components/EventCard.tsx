
import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Calendar, MapPin, Users, Share2, LinkIcon, Facebook, Twitter, Edit, Trash2, MessageSquare, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";
import { Slider } from "./ui/slider";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/AuthProvider";
import { Link } from "wouter";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import WeatherDisplay from "./WeatherDisplay";
import type { Event, Participant, EventType } from "@db/schema";
import type { WeatherInfo } from "../../server/services/weather";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

interface EventCardProps {
  event: Event & {
    participants: Participant[];
    eventType: EventType;
    weather: WeatherInfo | null;
  };
  fullscreen?: boolean;
}

export default function EventCard({ event, fullscreen = false }: EventCardProps) {
  const { user } = useAuth();
  const [participantName, setParticipantName] = React.useState(user?.displayName || "");
  const [participantEmail, setParticipantEmail] = React.useState(user?.email || "");
  const [joinType, setJoinType] = React.useState<"yes" | "maybe">("yes");
  const [likelihood, setLikelihood] = React.useState(0.5);
  const [isOpen, setIsOpen] = React.useState(false);
  const [comment, setComment] = useState('');
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [isResponseEditDialogOpen, setIsResponseEditDialogOpen] = useState(false);
  const [isEventEditDialogOpen, setIsEventEditDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const canEditResponse = (participant: Participant) => {
    if (!participant.responseToken) return false;
    if (user?.uid) {
      return participant.responseToken === user.uid;
    }
    const storedToken = localStorage.getItem(`response-token-${participant.id}`);
    return Boolean(storedToken && storedToken === participant.responseToken);
  };

  const calculateProgress = () => {
    if (!event?.participants) return 0;
    const total = event.participants.reduce((sum, participant) => {
      const likelihood = participant.likelihood ? Number(participant.likelihood) : 1;
      return sum + likelihood;
    }, 0);
    return (total / event.participantThreshold) * 100;
  };

  const progressPercentage = calculateProgress();
  const hasMinimumParticipants = progressPercentage >= 100;
  const canDelete = user && event.creatorId === user.uid;

  const joinEvent = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${event.urlHash}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: participantName,
          email: participantEmail,
          likelihood: joinType === "yes" ? 1 : likelihood,
          uid: user?.uid,
          comment
        }),
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to join event");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (!user?.uid && data.responseToken) {
        localStorage.setItem(`response-token-${data.id}`, data.responseToken);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
      toast({ title: "Success", description: "You've joined the event!" });
      setIsOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editResponse = useMutation({
    mutationFn: async (values: { participantId: number; name: string; email: string; likelihood: number; comment: string }) => {
      const responseToken = user?.uid || localStorage.getItem(`response-token-${values.participantId}`);
      if (!responseToken) throw new Error("Not authorized to edit");

      const res = await fetch(`/api/events/${event.urlHash}/participants/${values.participantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, responseToken }),
      });
      if (!res.ok) throw new Error("Failed to update response");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
      toast({ title: "Success", description: "Response updated!" });
      setEditingParticipant(null);
      setIsResponseEditDialogOpen(false);
    },
  });

  return (
    <Card className={`w-full ${fullscreen ? "max-w-4xl mx-auto mt-6" : ""}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <Link href={`/events/${event.urlHash}`}>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold hover:text-primary cursor-pointer">
                  {event.title}
                </h3>
                <span 
                  className="text-sm px-2 py-0.5 rounded-full" 
                  style={{ 
                    backgroundColor: event.eventType?.color ? `${event.eventType.color}20` : '#eee',
                    color: event.eventType?.color || '#666'
                  }}
                >
                  {event.eventType?.name || 'Event'}
                </span>
              </div>
            </Link>
            <div className="text-sm text-muted-foreground flex items-center">
              <MapPin className="mr-2 h-4 w-4" />
              <button
                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`, '_blank')}
                className="text-primary hover:underline"
              >
                {event.location}
              </button>
            </div>
          </div>
          {event.isPrivate && (
            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full flex items-center gap-1">
              <EyeOff className="h-3 w-3" />
              Private
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center text-sm">
              <Calendar className="mr-2 h-4 w-4" />
              <span>{new Date(event.date).toLocaleDateString()}</span>
              {event.endTime && (
                <span className="text-muted-foreground ml-1">
                  - {new Date(event.endTime).toLocaleTimeString()}
                </span>
              )}
            </div>

            {event.isRecurring && (
              <div className="flex items-center text-sm text-muted-foreground mt-1">
                <Calendar className="mr-2 h-4 w-4" />
                Recurring {event.recurrenceFrequency} event
              </div>
            )}

            {event.notes && (
              <div className="flex items-center text-sm text-muted-foreground">
                <MessageSquare className="mr-2 h-4 w-4" />
                {event.notes}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center text-sm mb-2">
              <Users className="mr-2 h-4 w-4" />
              <span>
                {event.participantThreshold} participants needed / {event.participants.length || 0} responded
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2 mt-2" />

            <div className="mt-4 space-y-2">
              {event.participants.map((participant) => (
                <div key={participant.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span>{participant.name}</span>
                    <span 
                      className={`px-2 py-0.5 rounded-full ${
                        participant.likelihood === 1 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {participant.likelihood === 1 ? 'Yes' : `Maybe (${Math.round(participant.likelihood * 100)}%)`}
                    </span>
                    {participant.comment && (
                      <span className="text-muted-foreground">
                        ({participant.comment})
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {(canEditResponse(participant) || canDelete) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (confirm(`Remove ${participant.name}'s response?`)) {
                            try {
                              const response = await fetch(`/api/events/${event.urlHash}/participants/${participant.id}`, {
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" }
                              });

                              if (!response.ok) {
                                throw new Error('Failed to delete response');
                              }

                              queryClient.invalidateQueries({ queryKey: queryKeys.events.single(event.urlHash) });
                              queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
                              toast({ title: "Success", description: "Response removed successfully" });
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "Failed to remove response",
                                variant: "destructive"
                              });
                            }
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {event.weather && <WeatherDisplay weather={event.weather} />}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        {event.participants.some(p => {
          const responseToken = user?.uid || localStorage.getItem(`response-token-${p.id}`);
          return p.responseToken === responseToken;
        }) ? (
          <Button
            className="flex-1"
            onClick={() => {
              const participant = event.participants.find(p => {
                const responseToken = user?.uid || localStorage.getItem(`response-token-${p.id}`);
                return p.responseToken === responseToken;
              });
              if (participant) {
                setEditingParticipant(participant);
                setParticipantName(participant.name);
                setParticipantEmail(participant.email || '');
                setJoinType(!participant.likelihood || participant.likelihood === 1 ? "yes" : "maybe");
                setLikelihood(participant.likelihood || 0.5);
                setComment(participant.comment || '');
                setIsResponseEditDialogOpen(true);
              }
            }}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Response
          </Button>
        ) : (
          <Button
            className="flex-1"
            onClick={() => setIsOpen(true)}
            variant={hasMinimumParticipants ? "outline" : "default"}
          >
            {hasMinimumParticipants ? "Join Event (Has Enough Participants)" : "Join Event"}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Share2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/events/${event.urlHash}`);
              toast({ title: "Link Copied", description: "Event link copied to clipboard!" });
            }}>
              <LinkIcon className="mr-2 h-4 w-4" />
              Copy Link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              window.open(
                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/events/${event.urlHash}`)}`,
                '_blank'
              );
            }}>
              <Facebook className="mr-2 h-4 w-4" />
              Share on Facebook
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              window.open(
                `https://twitter.com/intent/tweet?url=${encodeURIComponent(`${window.location.origin}/events/${event.urlHash}`)}&text=${encodeURIComponent(`Join our event!`)}`,
                '_blank'
              );
            }}>
              <Twitter className="mr-2 h-4 w-4" />
              Share on Twitter
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              window.open(
                `sms:?body=${encodeURIComponent(`Join our event: ${window.location.origin}/events/${event.urlHash}`)}`,
                '_blank'
              );
            }}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Share via SMS
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {canDelete && (
          <>
            <Button variant="outline" size="icon" onClick={() => setIsEventEditDialogOpen(true)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </CardFooter>

      {/* Join Event Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Event</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            joinEvent.mutate();
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={participantEmail}
                onChange={(e) => setParticipantEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Are you joining?</Label>
              <RadioGroup 
                value={joinType} 
                onValueChange={(value: "yes" | "maybe") => setJoinType(value)}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="yes" />
                  <Label htmlFor="yes">Yes, I'll be there!</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="maybe" id="maybe" />
                  <Label htmlFor="maybe">Maybe (set likelihood below)</Label>
                </div>
              </RadioGroup>
            </div>

            {joinType === "maybe" && (
              <div className="space-y-2">
                <Label htmlFor="likelihood">How likely are you to join? ({Math.round(likelihood * 100)}%)</Label>
                <Slider
                  id="likelihood"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[likelihood]}
                  onValueChange={([value]) => setLikelihood(value)}
                />
              </div>
            )}

            <div>
              <Label htmlFor="comment">Comment (optional)</Label>
              <Input
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Any notes about your attendance?"
                maxLength={100}
              />
            </div>

            <Button type="submit" className="w-full" disabled={!participantName.trim() || joinEvent.isPending}>
              {joinEvent.isPending ? "Joining..." : "Join Event"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Event Edit Dialog */}
      <Dialog open={isEventEditDialogOpen} onOpenChange={setIsEventEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            // Event edit logic will be implemented here
            setIsEventEditDialogOpen(false);
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Event Type</Label>
              <EventTypeSelect 
                value={event.eventTypeId}
                onChange={(value) => {/* Event edit logic */}}
              />
            </div>
            <div className="space-y-2">
              <Label>Event Visibility</Label>
              <Select
                value={event.isPrivate ? 'private' : 'public'}
                onValueChange={(value) => {/* Event edit logic */}}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public (Visible on homepage)</SelectItem>
                  <SelectItem value="private">Private (Only accessible via URL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={event.title}
                onChange={(e) => {/* Event edit logic */}}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={event.location}
                onChange={(e) => {/* Event edit logic */}}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date & Time</Label>
              <Input
                id="date"
                type="datetime-local"
                value={event.date.slice(0, 16)}
                onChange={(e) => {/* Event edit logic */}}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time (Optional)</Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={event.endTime?.slice(0, 16) || ''}
                onChange={(e) => {/* Event edit logic */}}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="participantThreshold">Participant Threshold</Label>
              <Input
                id="participantThreshold"
                type="number"
                min="2"
                value={event.participantThreshold}
                onChange={(e) => {/* Event edit logic */}}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={event.notes || ''}
                onChange={(e) => {/* Event edit logic */}}
              />
            </div>
            <Button type="submit">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Response Dialog */}
      <Dialog open={isResponseEditDialogOpen} onOpenChange={setIsResponseEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Response</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editingParticipant) return;
            editResponse.mutate({
              participantId: editingParticipant.id,
              name: participantName,
              email: participantEmail,
              likelihood: joinType === "yes" ? 1 : likelihood,
              comment: comment
            });
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Are you joining?</Label>
              <RadioGroup value={joinType} onValueChange={(v: "yes" | "maybe") => setJoinType(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="edit-yes" />
                  <Label htmlFor="edit-yes">Yes, I'm in!</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="maybe" id="edit-maybe" />
                  <Label htmlFor="edit-maybe">Maybe, depends...</Label>
                </div>
              </RadioGroup>
            </div>

            {joinType === "maybe" && (
              <div className="space-y-2">
                <Label>How likely are you to attend?</Label>
                <div className="flex items-center space-x-2">
                  <Slider
                    min={10}
                    max={90}
                    step={10}
                    value={[likelihood * 100]}
                    onValueChange={([value]) => setLikelihood(value / 100)}
                  />
                  <span className="w-12 text-right">{Math.round(likelihood * 100)}%</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email (optional)</Label>
              <Input
                id="edit-email"
                type="email"
                value={participantEmail}
                onChange={(e) => setParticipantEmail(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="edit-comment">Comment (optional)</Label>
              <Input
                id="edit-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Any notes about your attendance?"
                maxLength={100}
              />
            </div>

            <Button type="submit" className="w-full">
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
