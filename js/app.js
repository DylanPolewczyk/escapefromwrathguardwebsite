(function () {
    const DATA_PATH = "data/talent-trees.json";
    const STORAGE_KEY = "wrathguardTalentPreviewRanks";
    const BOARD_WIDTH = 1760;
    const BOARD_HEIGHT = 1820;
    const BOARD_SIDE_PADDING = 0.06;
    const BOARD_TOP_PADDING = 0.065;
    const BOARD_X_SPREAD = 1.18;
    const BOARD_Y_SPREAD = 1.12;

    const state = {
        data: null,
        tree: null,
        selectedNodeId: null,
        previewRanks: loadPreviewRanks()
    };

    document.addEventListener("DOMContentLoaded", initialize);

    async function initialize() {
        try {
            state.data = await loadTalentData();
        } catch (error) {
            showStateMessage(buildLoadFailureMessage(error));
            console.error(error);
            return;
        }

        if (!state.data || !Array.isArray(state.data.classes) || state.data.classes.length === 0) {
            showStateMessage("No talent tree data was found. Run the Unity menu action Tools > Talent Trees > Export Web Preview Data to generate data/talent-trees.json.");
            return;
        }

        const page = document.body.dataset.page;
        if (page === "tree") {
            initializeTreePage();
            return;
        }

        initializeIndexPage();
    }

    async function loadTalentData() {
        const response = await fetch(DATA_PATH, { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Failed to load talent tree data.");
        }

        return response.json();
    }

    function initializeIndexPage() {
        const grid = document.getElementById("classGrid");
        if (!grid) {
            return;
        }

        grid.replaceChildren();
        state.data.classes.forEach(function (tree, index) {
            const card = document.createElement("a");
            card.className = "class-card reveal-up";
            card.href = "talent-tree.html?class=" + encodeURIComponent(tree.classId);
            card.style.setProperty("--accent-color", tree.accentColor || "rgba(217, 168, 79, 0.24)");
            card.style.animationDelay = (index * 55) + "ms";

            const eyebrow = createElement("div", "eyebrow", tree.displayName || tree.classId);
            const title = createElement("h2", "class-card-title", tree.title || tree.classId);
            const summary = createElement("p", "class-card-summary", tree.description || "Open this class to inspect its full talent board.");

            const tags = document.createElement("div");
            tags.className = "class-card-tags";
            (tree.branchLabels || []).slice(0, 3).forEach(function (label) {
                const tag = createElement("span", "class-tag", label.text || "Branch");
                tags.appendChild(tag);
            });

            const meta = document.createElement("div");
            meta.className = "class-card-tags";
            meta.appendChild(createElement("span", "class-tag", countVisibleNodes(tree) + " Nodes"));
            meta.appendChild(createElement("span", "class-tag", countActiveNodes(tree) + " Active"));

            card.appendChild(eyebrow);
            card.appendChild(title);
            card.appendChild(summary);
            card.appendChild(tags);
            card.appendChild(meta);
            grid.appendChild(card);
        });
    }

    function initializeTreePage() {
        const classId = getRequestedClassId();
        bindViewerButtons();
        bindTooltipDismiss();
        window.addEventListener("resize", handleBoardResize);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(handleBoardResize).catch(function () {});
        }

        const tree = findTree(classId) || state.data.classes[0];
        setCurrentTree(tree.classId);
    }

    function bindViewerButtons() {
        const addRankButton = document.getElementById("addRankButton");
        const removeRankButton = document.getElementById("removeRankButton");
        const clearRankButton = document.getElementById("clearRankButton");
        const resetClassPreviewButton = document.getElementById("resetClassPreviewButton");

        if (addRankButton) {
            addRankButton.addEventListener("click", function () {
                const node = getSelectedNode();
                if (!node || node.placeholder) {
                    return;
                }

                const nextRank = Math.min(node.rankCount || 0, getPreviewRank(node.id) + 1);
                setPreviewRank(node.id, nextRank);
            });
        }

        if (removeRankButton) {
            removeRankButton.addEventListener("click", function () {
                const node = getSelectedNode();
                if (!node || node.placeholder) {
                    return;
                }

                const nextRank = Math.max(0, getPreviewRank(node.id) - 1);
                setPreviewRank(node.id, nextRank);
            });
        }

        if (clearRankButton) {
            clearRankButton.addEventListener("click", function () {
                const node = getSelectedNode();
                if (!node || node.placeholder) {
                    return;
                }

                setPreviewRank(node.id, 0);
            });
        }

        if (resetClassPreviewButton) {
            resetClassPreviewButton.addEventListener("click", function () {
                if (!state.tree) {
                    return;
                }

                state.previewRanks[state.tree.classId] = {};
                persistPreviewRanks();
                renderTreeStats();
                renderBoard();
            });
        }
    }

    function bindTooltipDismiss() {
        document.addEventListener("click", handleTooltipDocumentClick);
        document.addEventListener("keydown", handleTooltipEscape);
    }

    function handleTooltipDocumentClick(event) {
        if (!state.selectedNodeId) {
            return;
        }

        if (event.target.closest(".talent-node") || event.target.closest(".node-tooltip")) {
            return;
        }

        state.selectedNodeId = null;
        renderBoard();
    }

    function handleTooltipEscape(event) {
        if (event.key !== "Escape" || !state.selectedNodeId) {
            return;
        }

        state.selectedNodeId = null;
        renderBoard();
    }

    function getRequestedClassId() {
        const params = new URLSearchParams(window.location.search);
        return params.get("class") || "";
    }

    function setCurrentTree(classId) {
        const tree = findTree(classId);
        if (!tree) {
            return;
        }

        state.tree = tree;
        ensurePreviewClassBucket(tree.classId);

        if (state.selectedNodeId && !getNodeById(state.selectedNodeId)) {
            state.selectedNodeId = null;
        }

        const params = new URLSearchParams(window.location.search);
        params.set("class", tree.classId);
        history.replaceState({}, "", "?" + params.toString());

        renderClassRail();
        renderHero();
        renderTreeStats();
        renderBoard();
    }

    function renderClassRail() {
        const rail = document.getElementById("classRail");
        if (!rail) {
            return;
        }

        rail.replaceChildren();
        state.data.classes.forEach(function (tree) {
            const button = createElement("button", "class-chip", tree.displayName || tree.classId);
            button.type = "button";
            if (state.tree && tree.classId === state.tree.classId) {
                button.classList.add("is-active");
            }

            button.addEventListener("click", function () {
                state.selectedNodeId = null;
                setCurrentTree(tree.classId);
            });
            rail.appendChild(button);
        });
    }

    function renderHero() {
        if (!state.tree) {
            return;
        }

        const treeHero = document.getElementById("treeHero");
        const treeEyebrow = document.getElementById("treeEyebrow");
        const treeTitle = document.getElementById("treeTitle");
        const treeDescription = document.getElementById("treeDescription");

        if (treeHero) {
            treeHero.style.setProperty("--accent-color", state.tree.accentColor || "rgba(217, 168, 79, 0.24)");
        }

        if (treeEyebrow) {
            treeEyebrow.textContent = state.tree.displayName || state.tree.classId;
        }

        if (treeTitle) {
            treeTitle.textContent = state.tree.title || state.tree.classId;
        }

        if (treeDescription) {
            treeDescription.textContent = state.tree.description || "Browse the full node graph, inspect descriptions, and preview local rank allocation.";
        }
    }

    function renderTreeStats() {
        const treeStats = document.getElementById("treeStats");
        if (!treeStats || !state.tree) {
            return;
        }

        treeStats.replaceChildren();
        const stats = [
            countVisibleNodes(state.tree) + " Nodes",
            countActiveNodes(state.tree) + " Active",
            getBranchCount(state.tree) + " Branches",
            getAllocatedPoints(state.tree.classId) + " Preview Points"
        ];

        stats.forEach(function (value) {
            treeStats.appendChild(createElement("span", "stat-pill", value));
        });
    }

    function renderBoard() {
        const board = document.getElementById("talentBoard");
        if (!board || !state.tree) {
            return;
        }

        board.replaceChildren();
        board.style.setProperty("--accent-color", state.tree.accentColor || "rgba(217, 168, 79, 0.24)");
        board.style.setProperty("--board-width", BOARD_WIDTH + "px");
        board.style.setProperty("--board-height", BOARD_HEIGHT + "px");

        const connectionLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        connectionLayer.classList.add("connection-layer");
        board.appendChild(connectionLayer);

        (state.tree.branchLabels || []).forEach(function (label) {
            const labelElement = createElement("div", "branch-label", label.text || "Branch");
            labelElement.style.left = toBoardPercent(label.normalizedPosition && label.normalizedPosition.x, "x");
            labelElement.style.top = toBoardPercent(label.normalizedPosition && label.normalizedPosition.y, "y");
            labelElement.style.color = label.color || "var(--gold)";
            board.appendChild(labelElement);
        });

        getAllNodesSorted(state.tree).forEach(function (node) {
            const element = renderNode(node);
            board.appendChild(element);
        });

        const selectedNode = getSelectedNode();
        if (selectedNode) {
            board.appendChild(renderNodeTooltip(selectedNode));
        }

        applyBoardFit();
    }

    function renderNode(node) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "talent-node";
        button.dataset.nodeId = node.id || "";
        button.style.left = toBoardPercent(node.normalizedPosition && node.normalizedPosition.x, "x");
        button.style.top = toBoardPercent(node.normalizedPosition && node.normalizedPosition.y, "y");
        if (node.tint) {
            button.style.borderColor = mixColor(node.tint, "rgba(255,255,255,0.12)");
        }

        if (node.activeAbility) {
            button.classList.add("is-active");
        }
        if (node.signature) {
            button.classList.add("is-signature");
        }
        if (node.placeholder || !node.displayName) {
            button.classList.add("is-placeholder");
        }
        if (state.selectedNodeId && node.id === state.selectedNodeId) {
            button.classList.add("is-selected");
        }

        const previewRank = getPreviewRank(node.id);
        if (previewRank > 0) {
            button.classList.add("is-ranked");
        }

        if (node.placeholder || !node.displayName) {
            button.disabled = true;
            return button;
        }

        const header = document.createElement("div");
        header.className = "node-header";

        const iconWrap = document.createElement("div");
        iconWrap.className = "node-icon-wrap";
        if (node.iconPath) {
            const icon = document.createElement("img");
            icon.src = encodeURI("data/" + node.iconPath);
            icon.alt = node.displayName;
            icon.loading = "lazy";
            iconWrap.appendChild(icon);
        } else {
            iconWrap.appendChild(createElement("div", "node-fallback-icon", getInitials(node.displayName)));
        }

        const kind = createElement("span", "node-kind", resolveNodeType(node));
        header.appendChild(iconWrap);
        header.appendChild(kind);

        const title = createElement("h3", "node-title", node.displayName);
        const pips = document.createElement("div");
        pips.className = "node-pips";
        for (let index = 0; index < Math.max(1, node.rankCount || 1); index += 1) {
            const pip = document.createElement("span");
            pip.className = "node-pip" + (index < previewRank ? " is-filled" : "");
            pips.appendChild(pip);
        }

        button.appendChild(header);
        button.appendChild(title);
        button.appendChild(pips);
        button.addEventListener("click", function (event) {
            event.stopPropagation();
            state.selectedNodeId = state.selectedNodeId === node.id ? null : node.id;
            renderBoard();
        });

        return button;
    }

    function renderNodeTooltip(node) {
        const previewRank = getPreviewRank(node.id);
        const tooltip = document.createElement("section");
        const tooltipPosition = resolveTooltipPosition(node);
        tooltip.className = "node-tooltip panel-cutout";
        tooltip.style.left = tooltipPosition.left + "px";
        tooltip.style.top = tooltipPosition.top + "px";
        tooltip.style.transform = tooltipPosition.transform;

        const body = document.createElement("div");
        body.className = "node-tooltip-body";

        const header = document.createElement("div");
        header.className = "node-tooltip-header";

        const heading = document.createElement("div");
        heading.className = "node-tooltip-heading";
        heading.appendChild(createElement("div", "eyebrow", resolveNodeType(node)));
        heading.appendChild(createElement("h2", "node-tooltip-title", node.displayName));

        const closeButton = createElement("button", "node-tooltip-close", "x");
        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "Close node details");
        closeButton.addEventListener("click", function (event) {
            event.stopPropagation();
            state.selectedNodeId = null;
            renderBoard();
        });

        header.appendChild(heading);
        header.appendChild(closeButton);

        const rankRow = document.createElement("div");
        rankRow.className = "node-tooltip-rank-row";
        rankRow.appendChild(createElement("span", "node-tooltip-rank-value", previewRank + " / " + (node.rankCount || 0)));
        rankRow.appendChild(createElement("span", "selected-rank-note", "Preview ranks are local only"));

        const description = createElement("p", "node-tooltip-description", node.description || "No description exported for this node yet.");

        const actions = document.createElement("div");
        actions.className = "node-tooltip-actions";
        actions.appendChild(createTooltipActionButton("Add Rank", "button-ornate", previewRank >= (node.rankCount || 0), function () {
            setPreviewRank(node.id, Math.min(node.rankCount || 0, previewRank + 1));
        }));
        actions.appendChild(createTooltipActionButton("Remove Rank", "button-ghost", previewRank <= 0, function () {
            setPreviewRank(node.id, Math.max(0, previewRank - 1));
        }));
        actions.appendChild(createTooltipActionButton("Clear", "button-ghost", previewRank <= 0, function () {
            setPreviewRank(node.id, 0);
        }));

        body.appendChild(header);
        body.appendChild(rankRow);
        body.appendChild(description);
        body.appendChild(actions);
        body.appendChild(renderTooltipDetailBlock("Prerequisites", resolveConnectedNodes(node.id, true)));
        body.appendChild(renderTooltipDetailBlock("Unlocks", resolveConnectedNodes(node.id, false)));

        tooltip.appendChild(body);
        return tooltip;
    }

    function createTooltipActionButton(label, className, disabled, onClick) {
        const button = createElement("button", className, label);
        button.type = "button";
        button.disabled = !!disabled;
        button.addEventListener("click", function (event) {
            event.stopPropagation();
            if (button.disabled) {
                return;
            }

            onClick();
        });
        return button;
    }

    function renderTooltipDetailBlock(label, items) {
        const block = document.createElement("div");
        block.className = "node-tooltip-detail-block";
        block.appendChild(createElement("div", "detail-label", label));

        const list = document.createElement("div");
        list.className = "detail-list";
        fillDetailList(list, items);
        block.appendChild(list);

        return block;
    }

    function resolveTooltipPosition(node) {
        const anchorX = toBoardPixel(node.normalizedPosition && node.normalizedPosition.x, "x");
        const anchorY = toBoardPixel(node.normalizedPosition && node.normalizedPosition.y, "y");
        const nodeX = Number(node.normalizedPosition && node.normalizedPosition.x || 0);
        const nodeY = Number(node.normalizedPosition && node.normalizedPosition.y || 0);

        const translateX = nodeX > 0.56 ? "calc(-100% - 92px)" : "92px";
        let translateY = "-50%";
        if (nodeY < 0.16) {
            translateY = "0";
        } else if (nodeY > 0.82) {
            translateY = "-100%";
        }

        return {
            left: Math.round(anchorX),
            top: Math.round(anchorY),
            transform: "translate(" + translateX + ", " + translateY + ")"
        };
    }

    function renderSelectedPanel() {
        const node = getSelectedNode();
        const title = document.getElementById("selectedNodeTitle");
        const type = document.getElementById("selectedNodeType");
        const rankValue = document.getElementById("selectedNodeRankValue");
        const description = document.getElementById("selectedNodeDescription");
        const prerequisites = document.getElementById("selectedPrerequisites");
        const unlocks = document.getElementById("selectedUnlocks");
        const addRankButton = document.getElementById("addRankButton");
        const removeRankButton = document.getElementById("removeRankButton");
        const clearRankButton = document.getElementById("clearRankButton");

        if (!node) {
            if (title) {
                title.textContent = "Select a node";
            }
            if (type) {
                type.textContent = "Talent";
            }
            if (rankValue) {
                rankValue.textContent = "0 / 0";
            }
            if (description) {
                description.textContent = "Choose a node to inspect its description and preview local rank allocation.";
            }
            fillDetailList(prerequisites, []);
            fillDetailList(unlocks, []);
            setPanelButtonsDisabled(true);
            return;
        }

        const previewRank = getPreviewRank(node.id);
        if (title) {
            title.textContent = node.displayName;
        }
        if (type) {
            type.textContent = resolveNodeType(node);
        }
        if (rankValue) {
            rankValue.textContent = previewRank + " / " + (node.rankCount || 0);
        }
        if (description) {
            description.textContent = node.description || "No description exported for this node yet.";
        }

        fillDetailList(prerequisites, resolveConnectedNodes(node.id, true));
        fillDetailList(unlocks, resolveConnectedNodes(node.id, false));

        if (addRankButton) {
            addRankButton.disabled = previewRank >= (node.rankCount || 0);
        }
        if (removeRankButton) {
            removeRankButton.disabled = previewRank <= 0;
        }
        if (clearRankButton) {
            clearRankButton.disabled = previewRank <= 0;
        }
    }

    function resolveConnectedNodes(nodeId, inbound) {
        if (!state.tree || !Array.isArray(state.tree.connections)) {
            return [];
        }

        return state.tree.connections
            .filter(function (connection) {
                return inbound ? connection.toId === nodeId : connection.fromId === nodeId;
            })
            .map(function (connection) {
                return inbound ? getNodeById(connection.fromId) : getNodeById(connection.toId);
            })
            .filter(Boolean)
            .map(function (node) {
                return node.displayName || node.id;
            });
    }

    function fillDetailList(container, items) {
        if (!container) {
            return;
        }

        container.replaceChildren();
        if (!items || items.length === 0) {
            container.appendChild(createElement("span", "detail-item-muted", "None"));
            return;
        }

        items.forEach(function (item) {
            container.appendChild(createElement("span", "detail-item", item));
        });
    }

    function renderConnections() {
        const board = document.getElementById("talentBoard");
        if (!board || !state.tree) {
            return;
        }

        const layer = board.querySelector(".connection-layer");
        if (!layer) {
            return;
        }

        const boardRect = board.getBoundingClientRect();
        const width = Math.max(1, Math.round(boardRect.width));
        const height = Math.max(1, Math.round(boardRect.height));
        layer.setAttribute("viewBox", "0 0 " + width + " " + height);
        layer.setAttribute("width", String(width));
        layer.setAttribute("height", String(height));
        while (layer.firstChild) {
            layer.removeChild(layer.firstChild);
        }

        if (!Array.isArray(state.tree.connections)) {
            return;
        }

        state.tree.connections.forEach(function (connection) {
            const fromElement = board.querySelector('[data-node-id="' + cssEscape(connection.fromId) + '"]');
            const toElement = board.querySelector('[data-node-id="' + cssEscape(connection.toId) + '"]');
            if (!fromElement || !toElement) {
                return;
            }

            const fromRect = fromElement.getBoundingClientRect();
            const toRect = toElement.getBoundingClientRect();

            const x1 = (fromRect.left - boardRect.left) + (fromRect.width / 2);
            const y1 = (fromRect.top - boardRect.top) + (fromRect.height / 2);
            const x2 = (toRect.left - boardRect.left) + (toRect.width / 2);
            const y2 = (toRect.top - boardRect.top) + (toRect.height / 2);
            const midpoint = (y1 + y2) / 2;

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", "M " + x1 + " " + y1 + " C " + x1 + " " + midpoint + ", " + x2 + " " + midpoint + ", " + x2 + " " + y2);
            path.setAttribute("class", "connection-path" + (getPreviewRank(connection.fromId) > 0 ? " is-energized" : ""));
            layer.appendChild(path);
        });
    }

    let connectionFrame = 0;
    function scheduleConnectionRender() {
        window.cancelAnimationFrame(connectionFrame);
        connectionFrame = window.requestAnimationFrame(renderConnections);
    }

    function handleBoardResize() {
        applyBoardFit();
    }

    function applyBoardFit() {
        const board = document.getElementById("talentBoard");
        const boardFit = document.getElementById("boardFit");
        const boardScroll = document.querySelector(".board-scroll");
        if (!board || !boardFit || !boardScroll) {
            return;
        }

        const availableWidth = Math.max(1, boardScroll.clientWidth);
        const scale = Math.min(1, availableWidth / BOARD_WIDTH);
        board.style.transform = scale < 0.999 ? "scale(" + scale + ")" : "none";
        boardFit.style.height = Math.round(BOARD_HEIGHT * scale) + "px";
        scheduleConnectionRender();
    }

    function getSelectedNode() {
        return getNodeById(state.selectedNodeId);
    }

    function getNodeById(nodeId) {
        if (!state.tree || !nodeId || !Array.isArray(state.tree.nodes)) {
            return null;
        }

        for (let index = 0; index < state.tree.nodes.length; index += 1) {
            const node = state.tree.nodes[index];
            if (node && node.id === nodeId) {
                return node;
            }
        }

        return null;
    }

    function getAllNodesSorted(tree) {
        return (tree.nodes || []).slice().sort(function (left, right) {
            const leftPlaceholder = left && left.placeholder ? 1 : 0;
            const rightPlaceholder = right && right.placeholder ? 1 : 0;
            if (leftPlaceholder !== rightPlaceholder) {
                return leftPlaceholder - rightPlaceholder;
            }

            const leftY = left && left.normalizedPosition ? left.normalizedPosition.y : 0;
            const rightY = right && right.normalizedPosition ? right.normalizedPosition.y : 0;
            if (leftY !== rightY) {
                return leftY - rightY;
            }

            const leftX = left && left.normalizedPosition ? left.normalizedPosition.x : 0;
            const rightX = right && right.normalizedPosition ? right.normalizedPosition.x : 0;
            return leftX - rightX;
        });
    }

    function getVisibleNodes(tree) {
        return (tree.nodes || []).filter(function (node) {
            return node && !node.placeholder && node.displayName;
        });
    }

    function countVisibleNodes(tree) {
        return getVisibleNodes(tree).length;
    }

    function countActiveNodes(tree) {
        return getVisibleNodes(tree).filter(function (node) {
            return !!node.activeAbility;
        }).length;
    }

    function getBranchCount(tree) {
        return Array.isArray(tree.branchLabels) ? tree.branchLabels.length : 0;
    }

    function findTree(classId) {
        if (!state.data || !Array.isArray(state.data.classes)) {
            return null;
        }

        for (let index = 0; index < state.data.classes.length; index += 1) {
            const tree = state.data.classes[index];
            if (tree && tree.classId === classId) {
                return tree;
            }
        }

        return null;
    }

    function getPreviewRank(nodeId) {
        if (!state.tree || !nodeId) {
            return 0;
        }

        const classRanks = state.previewRanks[state.tree.classId] || {};
        return Number(classRanks[nodeId] || 0);
    }

    function setPreviewRank(nodeId, value) {
        if (!state.tree || !nodeId) {
            return;
        }

        ensurePreviewClassBucket(state.tree.classId);
        if (value <= 0) {
            delete state.previewRanks[state.tree.classId][nodeId];
        } else {
            state.previewRanks[state.tree.classId][nodeId] = value;
        }

        persistPreviewRanks();
        renderTreeStats();
        renderBoard();
        renderSelectedPanel();
    }

    function ensurePreviewClassBucket(classId) {
        if (!state.previewRanks[classId]) {
            state.previewRanks[classId] = {};
        }
    }

    function getAllocatedPoints(classId) {
        const classRanks = state.previewRanks[classId] || {};
        return Object.keys(classRanks).reduce(function (total, key) {
            return total + Number(classRanks[key] || 0);
        }, 0);
    }

    function loadPreviewRanks() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            console.warn("Unable to load preview ranks", error);
            return {};
        }
    }

    function persistPreviewRanks() {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.previewRanks));
        } catch (error) {
            console.warn("Unable to persist preview ranks", error);
        }
    }

    function resolveNodeType(node) {
        if (!node) {
            return "Talent";
        }

        if (node.signature && node.activeAbility) {
            return "Capstone Active";
        }
        if (node.signature) {
            return "Capstone Passive";
        }
        return node.activeAbility ? "Active Talent" : "Passive Talent";
    }

    function setPanelButtonsDisabled(disabled) {
        ["addRankButton", "removeRankButton", "clearRankButton"].forEach(function (id) {
            const element = document.getElementById(id);
            if (element) {
                element.disabled = disabled;
            }
        });
    }

    function toBoardPercent(value, axis) {
        return (resolveBoardCoordinate(value, axis) * 100).toFixed(3) + "%";
    }

    function toBoardPixel(value, axis) {
        const size = axis === "x" ? BOARD_WIDTH : BOARD_HEIGHT;
        return resolveBoardCoordinate(value, axis) * size;
    }

    function resolveBoardCoordinate(value, axis) {
        const numericValue = clamp(Number(value || 0), 0, 1);
        if (axis === "x") {
            return normalizeBoardCoordinate((((numericValue - 0.5) * BOARD_X_SPREAD) + 0.5), BOARD_SIDE_PADDING);
        }

        return normalizeBoardCoordinate(numericValue * BOARD_Y_SPREAD, BOARD_TOP_PADDING);
    }

    function normalizeBoardCoordinate(value, padding) {
        const contentSpan = 1 - (padding * 2);
        return padding + (clamp(value, 0, 1) * contentSpan);
    }

    function createElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) {
            element.className = className;
        }
        if (text !== undefined) {
            element.textContent = text;
        }
        return element;
    }

    function getInitials(name) {
        return String(name || "?")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(function (part) {
                return part.charAt(0).toUpperCase();
            })
            .join("") || "?";
    }

    function buildLoadFailureMessage(error) {
        const baseMessage = "Could not load talent tree data. Make sure data/talent-trees.json exists and the site is served through a web host or local static server.";
        if (window.location.protocol === "file:") {
            return baseMessage + " Opening the HTML file directly from disk blocks JSON fetches in many browsers.";
        }

        return baseMessage + (error && error.message ? " " + error.message : "");
    }

    function showStateMessage(message) {
        document.querySelectorAll("[data-state-message]").forEach(function (element) {
            element.textContent = message;
            element.classList.remove("hidden");
        });
    }

    function mixColor(primaryColor, fallbackColor) {
        return primaryColor || fallbackColor || "rgba(255,255,255,0.12)";
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function cssEscape(value) {
        if (window.CSS && typeof window.CSS.escape === "function") {
            return window.CSS.escape(value);
        }

        return String(value).replace(/([ #;?%&,.+*~\':"!^$\[\]()=>|\/])/g, "\\$1");
    }
})();