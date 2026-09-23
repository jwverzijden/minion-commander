# Minion Commander

Minion Commander is a 2d town building game where the player instructs minions to gather resources, work at a building or construct buildings.

## lore
Far far in the future, humans have left the planet and now only their minions remain. The minions are slowly dying out as they require the humans to guide them, in an attempt to save them a satelite was launched to orbit earth and assit the minions. You are a minion commander, it is your duty to help them survive, help them grow their numbers and thrive on the old planet.


## resources
resources can be collected from the world by harvesting specific tiles or crafted with a factory.

wood -> planks -> gears
        planks -> refined planks
stone -> gravel
iron ore -> iron ingot
copper ore -> copper ingot -> copper wire

## buildings
buildings must be connected to a path. minions can only walk on paths unless their job requires them to venture off the path. All buildings have a door at 1 corner and 1 side, when placing a building ghost to be build it can be rotated 90 degree with R, a building with no construction cost still needs to be build by a minion, building something with no cost takes 1/15th of an ingame hour. a minion can deliver materials to a construction site from a path next to the construction site.

path
    - description: to move to places
    - footprint: 1x1
    - workplaces: 0
    - cost: no cost
fast path
    - description: to move to places faster
    - footprint: 1x1
    - workplaces: 0
    - cost: 5 gravel
collecting station
    - description: collect wood, stone, iron ore
    - footprint: 1x1
    - workplaces: 1
    - cost: no cost
minion recharge station
    - description: recharges a depleted minion
    - footprint: 1x1
    - workplaces: 1 minion recharges at a time
    - cost: 5 wood
woodcutting station
    - description: cut trees
    - footprint: 2x2
    - workplaces: 2
    - cost: 5 wood
storage
    - description: 3 sizes of storage, small, medium and large. store items near a factory or a central storage
    - footprint:
        - small: 2x2
        - medium: 3x3
        - large: 4x4
    - workplaces: 0
    - cost:
        - small: 10 wood
        - medium: 20 wood + 10 planks
        - large: 40 wood + 20 planks
bridge
    - description: built on a river tile, allows a path or fast path to be placed on it
    - footprint: 1x1
    - workplaces: 0
    - cost: 5 planks
factory
    - description: craft planks, refined planks, gears, gravel or copper wire
    - footprint: 2x3
    - workplaces: 2
    - cost: 10 wood
foresting station
    - description: replant trees
    - footprint: 2x2
    - workplaces: 2
    - cost: 10 wood + 5 planks
transport station
    - description: helps move items to and from work place inventories
    - footprint: 3x3
    - workplaces: 4
    - cost: 20 wood + 15 planks + 5 refined planks
smeltery
    - description: smelt iron or copper ore into ingots
    - footprint: 3x3
    - workplaces: 2
    - cost: 10 wood + 10 planks + 10 iron ore + 20 gravel
drilling station
    - description: drill for stone or ore
    - footprint: 3z3
    - workplaces: 4
    - cost: 20 wood + 20 planks + 10 gears + 10 iron ingot + 5 copper wire + 40 gravel
minion duplication station
    - description: duplicates the minion
    - footprint: 2x2
    - workplaces: 1
    - cost: 20 refined planks + 10 gears + 10 iron ingot + 5 copper wire

### resource generators
tree
    - description: cut for wood
    - footprint: 1x1
    - drops: 2 wood when cut
    - grow time: 5 days
ore vein
    - description: build drilling station to harvest
    - footprint: 1x1

### storage
small storage holds 50 of 1 type of item in a 2x2 giving it 12.5 item density
medium storage holds 150 of 1 type of item in a 3x3 giving it 16.667 item density
large storage holds 400 of 1 type of item in a 4x4 giving it 25 item density


## progression

### game time cycle
the game simulates a world with minions, these minions have their tasks and go about their business, for this to happen the game needs to simulate time progression. 1 day ingame has 24 hours, each ingame hour is 15 real life seconds, giving a ingame day 6 real life minutes and a minion a lifespan of 1 real life hour. minions are not affected by day or night tree growth is.

### minion lifespan
a minion does not work or live forever, a minion grows 10 days old before it dies. 

### battery lifespan
a minion has a battery which holds 20 hours of charge, it will deplete as they work jobs, walking doesnt cost battery energy, walking with items does. when the battery is depleted they need to recharge it. recharging in a recharge station takes 4 hours to refill. (if a transport station minion depletes their battery they finish their current delivery at 50% movement speed)

### advancing in the game
at first the player has to focus on collecting wood and building recharge stations, with those the player can start construction of a factory, using the factory and storage the player will be able to construct the more advnaced buildings. no tier system or unlocks required, the material cost is the limiting factor. 

### time cost
moving around, collecting and fabricating materials takes time, time is valuable so the player has to manage positioning construction in favorable locations, too long paths would lead to not enough work done before the minions die. this will probably need to be tuned later to balance the game.

#### walking speed
a minion walks at a speed of 7 tiles per hour on path and 10 tiles per hour on a fast path.
carrying a ore or a ingot has a 30% walking speed penalty.

### task duration and cost
collect material: 1 hour
cut tree: 1 hours
replant tree: 1 hour
craft 1 plank: 2 hours, requires 1 wood
craft 1 gear: 3 hours, requires 1 plank
craft 1 gravel: 2 hours, requires 1 stone
craft 1 iron ingot: 2 hours, requires 1 iron ore
craft 1 copper ingot: 2 hours, requires 1 copper ore
craft 1 copper wire: 2 hours, requires 1 copper ingot

### starting order of operations
1. build paths and wood collecting stations to nearby wood laying around
2. collect 5 wood
3. build woodcutting and collecting station near trees (perhaps optional since there is probably enough wood laying around)
4. collect 10 wood
5. build factory to craft planks
6. collect 10 wood and craft 5 planks
7. build foresting, woodcutting and collecting station near green land
8. collect 10 wood, build storage for wood
9. collect 5 wood, build recharge station

### tree growing
when a minion plants a tree on a tile, the tree will be fully mature and ready for cutting after 5 days. trees generated by world generation are fully mature from the start.

### inventory
all work stations have a small inventory to hold 5 input items and 5 output items. all crafts require 1 item input and 1 output, 5 capacity gives it a buffer. when a minion works at a workplace that requires input materials, it will collect until the input inventory is full, then it produces until the output inventory is full. 
storage have a single inventory that holds 1 type of item up to their max capacity, a minion can deliver a item to the storage or withdraw a item from it.

## world generation
the game world is a 100x100 tile world, in this world tiles with grass, stone and river generate, on grass tiles trees can spawn, on stone tiles ore veins can spawn. On the remaining tiles wood, stone or ore resources generate. trees generate in groups closely packed while ore veins generate sparsly with some distance in between.

generating the world happens in 4 phases, biomes, resource tiles, materials tiles and finally a starting location.

### 1 biome generation
since its just 2 biomes make everything grass and randomly place ovals of stone to create the stoney areas.
generate squigly lines across the map to generate the rivers.

### 2 resource tile generation
generate forests by placing filled ovals of trees in the grass areas, overlap with the stone areas is allowed but no trees in the stone area.
randomly place iron and copper ore veins in the stone areas.

### 3 material tile generation
generate wood items in the open green tiles.
generate stone, iron and copper items in the stone areas.

### 4 starting area
pick a location nearby a forest, place 5 minions on a tile each, in a 5x5 tile area.


## task assignment
while a minion is idle the game can select them to do take on a task, the game will select the closest idle minion to the task. 
a workplace can generate tasks: 
    a collecting station can collect any item in its 5 tile square radius. 
    a wood cutting station can assign any tree in its 5 tile square radius to be cut down. 
    a factory can assign tasks to craft or collect the required input material or deposit the produced items. 
    a foresting station can assign any empty green tile in its 5 tile square radius to be planted with a tree. 
    a transport station generates tasks to deliver a required item to a workplace and take a item from the workplace output inventory to deliver in a storage.
if a workplace inventory is full the minion will have to move the items to a storage, if no storage is available the minion will idle at the workplace until work becomes available or it gets reassigned to another job. if the workplace input inventory is empty the workplace generates a task to collect materials from a nearby storage or workplace inventory
a minion that ran out of energy generates its own task to recharge, it will pathfind the closest recharge station and recharge there, if it is occupied the minion will wait until it can recharge, once recharged it goes back to its workplace and continues its job.


## collisions
minions dont have collisions with other minions, they do collide with trees, veins and buildings. the building door tile is a exception i suppose, a minion is allowed to walk in from the path that attaches to the door if its assigned to the workplace.
material items on the ground have collision when its different types, each tile can only hold 1 type of material item, any amount is fine though. minions do not collide with material items
trees can only be planted on 'empty' tiles, a tile is concidered empty if there is no vein, no building, no path and no material item on the tile.
a minion could get stuck behind buildings, it is unfortunate but the player should be more careful, the game provides no direct solution to the problem other than destroying the buildings.

## lost minions
a minion is lost when its more than 5 tiles away from a path and needs to be rescued by building a path in its range.

## destroying buildings
a building can be destroyed, doing so refunds 50% of the building cost rounded up. the material items are placed on the tiles the building occupied, if the building footprint is smaller than the number of materials spill the remaining material items onto the path the building was connected to or if no path tiles available place them in free nearby tiles or delete the materials if there is no space at all.
destroying a building with a minion or items in the inventory places the minion on a tile where the building used to be, and adds the inventory items to the materials that will be placed to refund, no losses for the inventory items only for the construction cost.

## door position example
### 1x1
+--+
|  |
+dd+
<- path ->

### 2x2
+--+--+
|  |  |
+--+--+
|  |  |
+dd+--+
<- path ->

### 2x3
+--+--+--+
|  |  |  |
+--+--+--+
|  |  |  |
+dd+--+--+
<- path ->

### 3x3
+--+--+--+
|  |  |  |
+--+--+--+
|  |  |  |
+--+--+--+
|  |  |  |
+dd+--+--+
<- path ->

### 4x4
+--+--+--+--+
|  |  |  |  |
+--+--+--+--+
|  |  |  |  |
+--+--+--+--+
|  |  |  |  |
+--+--+--+--+
|  |  |  |  |
+dd+--+--+--+
<- path ->

## UI & control
### menus
the game has a main menu, here the player can continue an existing save, start a new game or change keybinds. while playing the game pressing esc pauses the game and saves the current state. the user can continue or exit to main menu. 
The main game is a canvas that fills the available window, at the top is a thin status bar with all resources, minion count, idle minion count, etc. listed side by side from the left. 
on the right side of this status bar is a pause/play toggle to pause the simulation, allowing the player to plan a build. spacebar is the hotkey for pause/play simulation.
at the bottom of the screen is a hotbar with all the buildings.

### buildings
a building has 3 stages, ghost, under construction and finished. when in the player selects a building on the hotbar the mouse pointer turns into a ghost of the building, pressing R rotates it 90 degree, moving it around snaps it to the tile grid. placing it creates a construction site of the buildings footprint size, once all materials have been delivered by minions the building is finished. 

### world viewport control
the world is rendered in 2d 3/4 view, the player can move the world with wasd, since we need rotated sprites for the buildings, rotating the world is can be done with e and q, giving it +90 or -90 degree rotation.
there is no zoom in or out functionality.
the wasd movement stops if the border of the world is at the edge of the viewport, the background is never visible.

## saving the game
every ingame day the game is auto saved, pressing esc saves the game as well.
there is 1 save slot, if the player starts a new game it overwrites the existing save. 

### drag building
click dragging a ghost path creates a line, when released the path construction sites are placed, if esc is pressed while dragging, cancel the ghost preview. this feature only applies to paths.
non paths have to be placed 1 by 1, placing a building doesnt clear the selection, the player can press esc to clear the selection or deselect by clicking the building on the hotbar.

