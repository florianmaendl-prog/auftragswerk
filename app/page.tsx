import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-16 px-4 max-w-4xl">
        <div className="mb-12">
          <h1 className="text-5xl font-semibold tracking-tight mb-3 uppercase">
            Auftragswerk
          </h1>
          <p className="text-xl text-muted-foreground">Assistenz, die mitdenkt.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Brand-Check</CardTitle>
                <CardDescription>Stahlblau, Hellgrau, Inter Font</CardDescription>
              </div>
              <Badge>v0.1</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <Button>Primary Button</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </div>

            <div className="flex gap-2 flex-wrap pt-2">
              <Badge>neu</Badge>
              <Badge variant="secondary">klassifiziert</Badge>
              <Badge variant="outline">entwurf bereit</Badge>
              <Badge variant="destructive">fehler</Badge>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Wenn die Primary-Buttons Stahlblau sind und die Schrift Inter ist, sieht der Brand-Setup gut aus.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}