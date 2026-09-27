const tagColors = [
    "bg-orange-100 text-orange-700", "bg-purple-100 text-purple-700", "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700", "bg-pink-100 text-pink-700", "bg-cyan-100 text-cyan-700",
    "bg-rose-100 text-rose-700", "bg-indigo-100 text-indigo-700",
];

export function getTagColor(tag) {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    return tagColors[Math.abs(hash) % tagColors.length];
}
