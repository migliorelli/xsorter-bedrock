import { world, system } from "@minecraft/server";

const GROUPS = [
    { name: "weapons", test: /(sword|bow|crossbow|trident|mace|arrow|shield)/ },
    { name: "tools", test: /(pickaxe|_axe|shovel|hoe|shears|fishing_rod|flint_and_steel|brush)/ },
    { name: "armors", test: /(helmet|chestplate|leggings|boots|elytra|turtle_shell)/ },
    { name: "ores", test: /(ingot|nugget|diamond|emerald|coal|redstone|lapis|quartz|netherite|raw_|_ore|amethyst)/ },
    { name: "food", test: /(apple|bread|beef|porkchop|mutton|chicken|rabbit|cod|salmon|potato|carrot|beetroot|melon|berries|cookie|cake|pie|stew|soup|steak|honey|kelp|golden_carrot)/ },
    { name: "plants", test: /(sapling|seeds|flower|tulip|dandelion|poppy|leaves|vine|fern|grass|bamboo|cactus|mushroom|wheat)/ },
    { name: "blocks", test: /(stone|dirt|planks|log|wood|brick|sand|gravel|glass|wool|concrete|terracotta|deepslate|netherrack|obsidian|cobble|slab|stairs|wall|fence)/ },
];

const OTHERS = GROUPS.length;

function groupIndex(typeId) {
    const id = typeId.replace("minecraft:", "");
    const idx = GROUPS.findIndex(g => g.test.test(id));
    return idx === -1 ? OTHERS : idx;
}

function sortContainer(container) {
    const items = [];

    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item) items.push(item.clone());
    }

    // merge stacks without modifying the original items.
    const merged = [];

    for (const item of items) {
        let remaining = item.amount;

        for (const existing of merged) {
            if (
                remaining > 0 &&
                existing.isStackableWith(item) &&
                existing.amount < existing.maxAmount
            ) {
                const moved = Math.min(
                    existing.maxAmount - existing.amount,
                    remaining
                );

                existing.amount += moved;
                remaining -= moved;
            }
        }

        if (remaining > 0) {
            const stack = item.clone();
            stack.amount = remaining;
            merged.push(stack);
        }
    }

    // sort by category, then alphabetically
    merged.sort((a, b) => {
        const groupDiff = groupIndex(a.typeId) - groupIndex(b.typeId);

        if (groupDiff !== 0) return groupDiff;

        return a.typeId.localeCompare(b.typeId);
    });

    // refill the inventory
    for (let i = 0; i < container.size; i++) {
        container.setItem(i, undefined);
    }

    for (let i = 0; i < merged.length; i++) {
        container.setItem(i, merged[i]);
    }
}

const COOLDOWN_TICKS = 10;
const cooldowns = new Set();

world.afterEvents.entityHitBlock.subscribe((ev) => {
    const player = ev.damagingEntity;
    const block = ev.hitBlock;

    if (player.typeId !== "minecraft:player") return;
    if (!player.isSneaking) return;

    const inventory = block.getComponent("minecraft:inventory");
    if (!inventory?.container) return;

    if (cooldowns.has(player.id)) return;
    cooldowns.add(player.id);

    try {
        sortContainer(inventory.container);
        player.playSound("random.click");
        player.onScreenDisplay.setActionBar("§aBaú organizado!");
    } catch (error) {
        console.warn(`Erro ao organizar baú: ${error}`);
    }

    system.runTimeout(() => {
        cooldowns.delete(player.id);
    }, COOLDOWN_TICKS);
});