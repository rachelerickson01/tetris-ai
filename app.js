
// Event listener - triggers when HTML file is finished loading
document.addEventListener('DOMContentLoaded', () => {

    const grid = document.querySelector('.grid'); // selects the grid class from index.html
    const gridSpacing = 10;
    const scoreDisplay = document.querySelector('#score');
    const startButton = document.querySelector('#start-button');

    // Ready for display and play events after the page is loaded.
    updateDisplay();
    document.body.addEventListener("keydown", function(event) { handleKeyDown(event); });
    startButton.onclick = handleStartButton;

    tests();
})

//-------------------------------------------------------------------------------------------------

// dictionary for color picking in randomPieceColorIndex()
const CellColorIndex = Object.freeze({BLACK: 0, RED: 1, GREEN: 2, BLUE: 3, YELLOW: 4, WHITE: 5, TRANSPARENT: 6})
const CellColorTable = ["#000000", "#C00000", "#00C000", "#0000C0", "#C0C000", "#FFFFFF", "#000000"];

// linear interpolation
function linearInterp(a, b, t) { return a + t * (b - a); };
function randomInt(min, max) { return Math.round(linearInterp(min, max, Math.random())); }

// generates a color index for the randomly selected piece color
function randomPieceColorIndex() {
    const minIndex = CellColorIndex.BLACK + 1; // colors are between the black and white indexes
    const maxIndex = CellColorIndex.WHITE -1; 
    return randomInt(minIndex, maxIndex);
}

//------------------------------------------------------------------------------------------------- 

// creates a point given x and y coordinates, with some helper functions
class Point {
    constructor(x, y) {
        this.x = x
        this.y = y
    }

    round() {
        return new Point(Math.round(this.x), Math.round(this.y));
    }
    add(pt) {
        return new Point(this.x + pt.x, this.y + pt.y);
    }
    sub(pt) {
        return new Point(this.x - pt.x, this.y - pt.y);
    }
}

//-------------------------------------------------------------------------------------------------

// this class enables us to have dynamic rectangle views of the griod
class Rect {

    //constructs a rect given edge locations
    constructor(l, t, r, b) {
        this.left = l; // x-coordinate of left edge
        this.top = t; // y-coordinate of top edge
        this.right = r; // x-coordinate of right edge
        this.bottom = b; // y-coordinate of bottom edge
    }

    toString() {
        return "[" + this.left + " " + this.top + " " + this.right + " " + this.bottom + "]";
    }

    // allows for us to return an empty ("zero-area") rect later
    static makeEmpty() {
        return new Rect(0, 0, 0, 0);
    }

    // returns a cloned copy of the given rect
    clone() {
        return new Rect(this.left, this.top, this.right, this.bottom);
    }

    // detects a zero-area or rect with negative edge lengths
    // origin (0,0) exists at grid's top-left position with all non-negative x, y
    empty() {
        return (this.left >= this.right || this.top >= this.bottom);
    }
    
    // ----------- GEOMETRY HELPER FUNCTIONS -----------
    width() {
        return this.right - this.left;
    }
    height() {
        return this.bottom - this.top; 
    }
    center() {
        return new Point((this.left + this.right)/2, (this.top + this.bottom)/2);
    }

    // ------------- SET RELATIONS FUNCTIONS --------------
    
    // returns true if r is in this rect
    contains(r) {

        if (this.empty() || r.empty()) return false;

        return (this.left <= r.left && this.top <= r.top && this.right >= r.right
            && this.bottom  >= r.bottom); 

    }

    // returns new rect that contains the union of rect and r - including unoccupied areas
    union(r) {

        // union with empty set is equal to the non-empty set, regardless empty rect location
        if (this.empty()) return r.clone(); 
        if (r.empty()) return this.clone();

        return new Rect(Math.min(this.left, r.left), Math.min(this.top, r.top), 
                        Math.max(this.right, r.right), Math.max(this.bottom, r.bottom));
    }

    // returns new rect that is the intersecion of rect and r 
    intersection(r) {

        if (this.empty() || r.empty()) return Rect.makeEmpty();

        return new Rect(Math.max(this.left, r.left), Math.max(this.top, r.top), 
                        Math.min(this.right, r.right), Math.min(this.bottom, r.bottom));

    }

    // returns true if intersection is not empty
    intersects(r) {
        return !this.intersection(r).empty()
    }

    // -------------- TRANSLATION/TRANSFORMATION -----------
    
    // performs translation given x and y increments 
    offset(x, y) {
        this.left += x; this.top +=y; this.right += x; this.bottom += y;
    }

    // performs relocation to specified location
    moveTo(x, y) {
        this.offset(x - this.left, y - this.top) 
    }

}   

//-------------------------------------------------------------------------------------------------

class IndexedImage {
    #data; // data entries are color indices
    #bounds;  // places the image in board coordinates
    #visibleBounds; // bounds of rect that encompasses the non-transparent pixels

    constructor(w, h, data = null) {
        if (data) {
            if (data.length < w * h) throw "IndexedImage bad dimensions";
            this.#data = data;
        } else {
            this.#data = new Uint8Array(w * h); // 1D array initialized to zero by default
        }
        this.#bounds = new Rect(0, 0, w, h); // (l, t, r, b) set at the origin
        this.#visibleBounds = null;
    }

    // lightweight copy. returned IndexImage shares data buffer with original (same memory location)!!
    shallowClone() {
        let clone = new IndexedImage(this.#bounds.width(), this.#bounds.height(), this.#data);
        clone.moveTo(this.#bounds.left, this.#bounds.top) // preserves location on board. why not assign?
        // assigns visible bounds if original has #visibleBounds, otherwise assigns null
        clone.#visibleBounds = this.#visibleBounds ? this.#visibleBounds.clone() : null;
        return clone;
    }

    // creates IndexedImage from 2d array
    // REVIEW INDEX LOGIC
    static from2DArray(array) {
        const rows = array.length; // num of 1d arrays in the 2d array
        const cols = array[0].length; // length of the 1d arrays
        let img = new IndexedImage(cols, rows);
        for (let r = 0; r < rows; ++r) {
            let index = img.#index(0, r); // should make index private?
            for (let c = 0; c < cols; ++c) {
                img.#data[index++] = array[r][c];
            }
        }
        return img;
    }

    fill(value) {
        this.#data.fill(value);
        this.#visibleBounds = null;
    }

    fillRect(r, value) {
        const area = this.#bounds.intersection(r);
        if (area.empty()) return;
        for (let y = area.top; y < area.bottom; ++y) {
            for (let x = area.left; x < area.right; ++x) {
                this.setValueAt(x, y, value);
            }
        }
    }


    // ADD COMMENTS
    copyRect(srcRect, srcImage, dstX, dstY, mergeMode = false) {
        const translation = new Point(dstX - srcRect.left, dstY - srcRect.top);
        const transSrcImg = srcImage.shallowClone();
        const transSrcRect = srcRect.clone();
        transSrcImg.offset(translation.x, translation.y);
        transSrcRect.offset(translation.x, translation.y);

        const area = this.#bounds.intersection(transSrcRect).intersection(transSrcImg.bounds());
        if (area.empty()) return;
        for (let y = area.top; y < area.bottom; ++y) {
            for (let x = area.left; x < area.right; ++x) {
                const value = transSrcImg.valueAt(x, y);
                // if mergeMode, transparent pixels are not copied
                if (!mergeMode || (value != CellColorIndex.TRANSPARENT)) 
                    this.setValueAt(x, y, value);
            }
        }
    }

    // merges values from image at the intersection of this and r
    // does not copy transparent pixels since mergeMode == true
    mergeRect(r, image) { this.copyRect(r, image, r.left, r.top, true) };

    visibleBounds() {
        if (!this.#visibleBounds) {
            // initalize visibleBounds to empty and located at origin for fully transparent image
            this.#visibleBounds = new Rect(this.#bounds.left, this.#bounds.top, this.#bounds.left, this.#bounds.top);
            for (let y = this.#bounds.top; y < this.#bounds.bottom; ++y) {
                let pixelRect = new Rect(this.#bounds.left, y, this.#bounds.left + 1, y + 1);
                for (let x = this.#bounds.left; x < this.#bounds.right; ++x) {
                    // collecting union of bounds for non transparent pixels
                    if (this.valueAt(x, y) != CellColorIndex.TRANSPARENT) {
                        this.#visibleBounds = this.#visibleBounds.union(pixelRect); 
                    }
                    pixelRect.offset(1, 0);
                }
            }
        }
        return this.#visibleBounds.clone()
    }

    // private method to convert 2d coordinates to 1d index into the #data array
    // x, y are in image coord space; convert to local offset from origin
    #index(x, y) { return (y - this.#bounds.top) * this.#bounds.width() + (x - this.#bounds.left); }

    bounds() { return this.#bounds.clone(); }

    offset(x, y) {
        this.#bounds.offset(x, y);
        if (this.#visibleBounds)
            this.#visibleBounds.offset(x, y);
    }

    moveTo(x, y) { this.offset(x - this.#bounds.left, y - this.#bounds.top); }

    // x, y are in image coord space
    valueAt(x, y) { return this.#data[this.#index(x, y)]; }

    setValueAt(x, y, value) {
        this.#data[this.#index(x, y)] = value;
        // PERFORMANCE: clearing #visibleBounds guarantees internal consistency, however is inefficient.
        // Would anticipate using setValueAt() heavily to be inefficient regardless
        // Should focus on using well-crafted loops for direct memory stores
        this.#visibleBounds = null;
    }
}

//-------------------------------------------------------------------------------------------------

// returns true if any visible (non transparent) pixels overlap between img1 and img2
function visibleOverlap(img1, img2) {
    const visOverlapRect = img1.visibleBounds().intersection(img2.visibleBounds());
    if (visOverlapRect.empty()) return false; // returns false if rects do not overlap

    // returns true as soon as a visible pixel overlap is found
    for (let y = visOverlapRect.top; y < visOverlapRect.bottom; ++y) {
        for (let x = visOverlapRect.left; x< visOverlapRect.right; ++x) {
            if (img1.valueAt(x, y) != CellColorIndex.TRANSPARENT 
            && img2.valueAt(x, y) != CellColorIndex.TRANSPARENT)
                return true;
        }
    }

    return false;
}

//-------------------------------------------------------------------------------------------------

// performs the transposition of srcImg using a transposition function that maps (x,y) to (x', y'))
function transposeImage(srcImg, transposition) {
    let dstImg = new IndexedImage(transposition.dstWidth, transposition.dstHeight)
    // srcImg top left may be non-zero
    // x, y are in local coordinate space (top left at 0, 0)
    // dstImg is located at (0, 0)
    for (let y = 0; y < srcImg.bounds().height(); ++y) {
        for (let x = 0; x < srcImg.bounds().width(); ++x) {
            const srcValue = srcImg.valueAt(srcImg.bounds().left + x, srcImg.bounds().top + y);
            const dstCoord = transposition.transpose(x, y);
            dstImg.setValueAt(dstCoord.x, dstCoord.y, srcValue);
        }
    }
    const offset = srcImg.bounds().center().round().sub(dstImg.bounds().center().round());
    dstImg.offset(offset.x, offset.y);
    return dstImg;
}

//-------------------------------------------------------------------------------------------------

//------------ ROTATION FUNCTIONS ------------------------

// returns the transposed image of srcImg rotated clockwise
function rotateCW(srcImg) {
    let transposition = {
        dstWidth: srcImg.bounds().height(),
        dstHeight: srcImg.bounds().width(),
        transpose(srcX, srcY) { return { x: this.dstWidth - srcY - 1, y: srcX }; }
    };
    return transposeImage(srcImg, transposition);
}

// returns the transposed image of srcImg rotated counterclockwise
// why img instead of srcImg?
function rotateCCW(img) {
    let transposition = {
        dstWidth: img.bounds().height(),
        dstHeight: img.bounds().width(),
        transpose(srcX, srcY) { return { x: srcY, y: this.dstHeight - srcX - 1 }; }
    };
    return transposeImage(img, transposition);
}

// returns the transposed image of srcImg rotated 180 degrees
// is this used later on??
function rotate180(img) {
    let transposition = {
        dstWidth: img.bounds().width(),
        dstHeight: img.bounds().height(),
        transpose(srcX, srcY) { return { x: this.dstWidth - srcX - 1, y: this.dstHeight - srcY - 1}; }
    }
    return transposeImage(img, transposition);
}

//-------------------------------------------------------------------------------------------------

//--------------- SHAPE FUNCTIONS ------------------------
// these return an IndexedImage of the corresponding shape in the given color value

//note to self: consider an alias for CellColorIndex.TRANSPARENT for readability

function makeLImage(colorValue) {
    const LImageArray = [   [CellColorIndex.TRANSPARENT, colorValue, CellColorIndex.TRANSPARENT],
                            [CellColorIndex.TRANSPARENT, colorValue, CellColorIndex.TRANSPARENT],
                            [CellColorIndex.TRANSPARENT, colorValue, colorValue]];
    return IndexedImage.from2DArray(LImageArray);
}

function makeTImage(colorValue) {
    const TImageArray = [   [CellColorIndex.TRANSPARENT, CellColorIndex.TRANSPARENT, CellColorIndex.TRANSPARENT],
                            [colorValue, colorValue, colorValue],
                            [CellColorIndex.TRANSPARENT, colorValue, CellColorIndex.TRANSPARENT]];
    return IndexedImage.from2DArray(TImageArray);
}

function makeBarImage(colorValue) {
    const barImageArray = [ [CellColorIndex.TRANSPARENT, colorValue, CellColorIndex.TRANSPARENT, CellColorIndex.TRANSPARENT],
                            [CellColorIndex.TRANSPARENT, colorValue, CellColorIndex.TRANSPARENT, CellColorIndex.TRANSPARENT],
                            [CellColorIndex.TRANSPARENT, colorValue, CellColorIndex.TRANSPARENT, CellColorIndex.TRANSPARENT],
                            [CellColorIndex.TRANSPARENT, colorValue, CellColorIndex.TRANSPARENT, CellColorIndex.TRANSPARENT]];
    return IndexedImage.from2DArray(barImageArray);
}

// any specific reason to choose this orientation over the horizontal spawning orientation?
function makeSImage(colorValue) {
    const SImageArray = [   [colorValue, CellColorIndex.TRANSPARENT, CellColorIndex.TRANSPARENT],
                            [colorValue, colorValue, CellColorIndex.TRANSPARENT],
                            [CellColorIndex.TRANSPARENT, colorValue, CellColorIndex.TRANSPARENT]];
    return IndexedImage.from2DArray(SImageArray);
}

// ----------ADDING THE Z, J AND SQUARE PIECES HERE----------------

// making Z with same orientation as S for consistency here
function makeZImage(colorValue) {
    const ZImageArray = [   [CellColorIndex.TRANSPARENT, CellColorIndex.TRANSPARENT, colorValue],
                            [CellColorIndex.TRANSPARENT, colorValue, colorValue],
                            [CellColorIndex.TRANSPARENT, colorValue, CellColorIndex.TRANSPARENT]];
    return IndexedImage.from2DArray(ZImageArray);
}

function makeJImage(colorValue) {
    const JImageArray = [   [CellColorIndex.TRANSPARENT, colorValue, CellColorIndex.TRANSPARENT],
                            [CellColorIndex.TRANSPARENT, colorValue, CellColorIndex.TRANSPARENT],
                            [colorValue, colorValue, CellColorIndex.TRANSPARENT]];
    return IndexedImage.from2DArray(JImageArray);
}

function makeSquareImage(colorValue) {
    const squareImageArray = [   [CellColorIndex.TRANSPARENT, CellColorIndex.TRANSPARENT, CellColorIndex.TRANSPARENT],
                                 [CellColorIndex.TRANSPARENT, colorValue, colorValue],
                                 [CellColorIndex.TRANSPARENT, colorValue, colorValue]];
    return IndexedImage.from2DArray(squareImageArray);
}

// creates a random piece of random color index. Could later consider picking from a set without replacement 
function makeRandomPiece() {
    const makers = [makeBarImage, makeLImage, makeJImage, makeSImage, makeZImage, makeTImage, makeSquareImage];
    const i = randomInt(0, makers.length - 1);
    return makers[i](randomPieceColorIndex());
}

//-------------------------------------------------------------------------------------------------

//------------------ GAME BOARD ------------------------------

// GameBoard manages an image that is the composite of placed pieces and the active piece.

class GameBoard {
    #compositeImage; // combination of placed pieces and active piece
    #stackImage; // placed pieces
    #activePiece; // descending piece
    #invalRect;
    #completedRowSet;
    static #theInstance;

    // creates a game board with transparent composite image and stack image components
    constructor(w, h) {
        this.#compositeImage = new IndexedImage(w, h);
        this.#compositeImage.fill(CellColorIndex.TRANSPARENT);
        this.#invalRect = this.#compositeImage.bounds();
        this.#stackImage = new IndexedImage(w, h);
        this.#stackImage.fill(CellColorIndex.TRANSPARENT);
        this.#completedRowSet = new Set();
        this.#activePiece = null;
    }

    // static instance because we should only have one instance of the GameBoard.
    static instance() {
        if (!GameBoard.#theInstance) {
            GameBoard.#theInstance = new GameBoard(10, 20); // REVISIT to find the board size from somewhere
            // we could format width and height in CSS and inject it here?
        }
        return GameBoard.#theInstance; // if instance already exists, return existing instance
    }

    bounds() { return this.#compositeImage.bounds(); }

    startPiece() {
        const piece = makeRandomPiece();
        // drop new piece at the top middle of the game board with its bottom row visible
        const visBounds = piece.visibleBounds();
        const left = Math.round((this.bounds().width() - visBounds.width()) / 2); 
        const bottom = 1;
        piece.offset(left - visBounds.left, bottom - visBounds.bottom);

        if (!this.#validPosition(piece)) return false; // caller should end the game

        this.#activePiece = piece;
        this.invalComposite(piece.visibleBounds());
        return true;
    }

    // resets the board to begin a new game
    resetBoard() {
        this.#stackImage.fill(CellColorIndex.TRANSPARENT);
        this.#invalRect = this.#compositeImage.bounds();
        this.startPiece();
    }

    // returns true if given piece is within board bounds 
    // and no viisble overlap with previously placed pieces
    #validPosition(piece) {
        // check board bounds, allowing some margin at the top for the descending piece
        let boardBounds = this.bounds();
        boardBounds.top -=4; // tweak as needed, but probably the maximum cushion needed
        if (!boardBounds.contains(piece.visibleBounds())) return false;

        // check visible overlap with previously placed pieces
        if (visibleOverlap(piece, this.#stackImage)) return false;

        return true;
    }

    // returns true if piece can be legally offset
    offsetPiece(x, y) {
        if (!this.#activePiece) return false;

        let newPiece = this.#activePiece.shallowClone();
        newPiece.offset(x, y);
        if (!this.#validPosition(newPiece)) return false;

        // update if offset position is valid
        this.updatePiece(newPiece);
        return true;
    }

    // returns true if piece can be legally rotated 
    // "cw" here is a boolean
    rotatePiece(cw) {
        if (!this.#activePiece) return false;

        let newPiece = cw? rotateCW(this.#activePiece) : rotateCCW(this.#activePiece);

        // if rotation causes invalid position (new width > old width), try some lateral offset
        // to place piece back within board bounds. 
        if (!this.#validPosition(newPiece)) {
            const oldBounds = this.#activePiece.visibleBounds();
            const newBounds = newPiece.visibleBounds();
            if (newBounds.width() <= oldBounds.width()) return false;

            // try the range of positions where new (wider) bounds overlap with the old bounds
            for (let x = oldBounds.right - newBounds.width(); x <= oldBounds.left; ++x) {
                if (x == newBounds.left) continue; // this location is already known to fail
                newPiece.moveTo(x, newPiece.bounds().top);
                if (this.#validPosition(newPiece)) {
                    this.updatePiece(newPiece);
                    return true;
                }
            }
            return false;
        }
        this.updatePiece(newPiece);
        return true;
    }

    rotatePieceCW() { return this.rotatePiece(true); }
    rotatePieceCCW() { return this.rotatePiece(false); }

    updatePiece(newPiece) {
        // inval to erase at the old location and draw at the new location
        if (this.#activePiece) {
            this.invalComposite(this.#activePiece.visibleBounds());
        }
        if (newPiece) {
            this.invalComposite(newPiece.visibleBounds());
        }
        this.#activePiece = newPiece;
    }

    // Copy the acive piece into the stack of placed pieces
    placeActivePiece() {
        if (this.#activePiece) {
            const visBounds = this.#activePiece.visibleBounds();
            this.#stackImage.mergeRect(visBounds, this.#activePiece);
            this.#activePiece = null;
            this.markCompletedRows(visBounds.top, visBounds.bottom);
            // given piece has likely arleady appeared at this location in composite when descending
            // update composite redundantly to be sure
            this.invalComposite(visBounds);
        }
    }

    // detects completed row and adds it to completedRowSet.
    // endRow is exclusive
    markCompletedRows(startRow, endRow) {
        const bounds = this.#stackImage.bounds();
        for (let y = startRow; y < endRow; ++y) {
            let rowComplete = true;
            for (let x = 0; x < bounds.right; ++x) {
                // if a transparent cell is found, row is not complete
                if (this.#stackImage.valueAt(x, y) == CellColorIndex.TRANSPARENT) {
                    rowComplete = false;
                    break;
                }
            }
            // add completed row to completedRowSet
            if (rowComplete) {
                const rowBounds = new Rect(0, y, bounds.right, y + 1);
                this.#stackImage.fillRect(rowBounds, CellColorIndex.WHITE);
                this.invalComposite(rowBounds);
                this.#completedRowSet.add(y);
            }
        }
    }

    collapseCompletedRows() {
        if (this.hasCompletedRows()) {
            const bounds = this.#stackImage.bounds();
            // copy incomplete rows to a new image, working from the bottom up
            const img = new IndexedImage(bounds.width(), bounds.height());
            img.fill(CellColorIndex.TRANSPARENT);
            let srcRow = bounds.bottom - 1;
            let dstRow = srcRow;
            while (srcRow >= 0) {
                if (!this.#completedRowSet.has(srcRow)) {
                    const srcRowBounds = new Rect(0, srcRow, bounds.right, srcRow + 1);
                    img.copyRect(srcRowBounds, this.#stackImage, 0, dstRow);
                    --dstRow; //incrementing up to the next row
                }
                --srcRow;
            }
            this.#stackImage = img;
            this.#completedRowSet.clear();
            this.invalComposite(this.bounds());
        }
    }

    hasCompletedRows() { return (this.#completedRowSet.size > 0); }

    invalComposite(r) {
        if (r) {
            this.#invalRect = this.#invalRect.union(r).intersection(this.bounds());
        }
        else { this.#invalRect = this.bounds(); } // inval all
    }

    updateComposite() {
        if (!this.#invalRect.empty()) {
            this.#compositeImage.fillRect(this.#invalRect, CellColorIndex.TRANSPARENT);
            this.#compositeImage.mergeRect(this.#stackImage.bounds().intersection(this.#invalRect), this.#stackImage);
            if (this.#activePiece) {
                this.#compositeImage.mergeRect(this.#activePiece.bounds().intersection(this.#invalRect), this.#activePiece);
            }
            this.#invalRect = Rect.makeEmpty();
        }
    }

    updateDisplay() {
        const area = this.#invalRect;
        if (!area.empty()) {
            this.updateComposite();
            GridDisplay.instance().displayImage(this.#compositeImage, area);
        }
    }
    
}

//-------------------------------------------------------------------------------------------------

class GameState {
    #phases;
    #phase;
    #resumePhase;
    #descentInfo;
    #collapseStepTime;
    #timer;
    static #theInstance = null;

    constructor() {
        this.#phases = Object.freeze({READY: 0, DESCENT: 1, COLLAPSE: 2, PAUSE: 3, END: 4})
        this.#phase = this.#phases.READY; // start in the ready phase
        this.#resumePhase = this.#phases.DESCENT; // when resuming the game, the descent phase occurs
        this.#descentInfo = { msStepTime: 0, msRate: 1000 };
        this.#collapseStepTime = 0;
        this.#timer = null;
    }

    // Should be only one GameState instance
    static instance() {
        if (!GameState.#theInstance) {
            GameState.#theInstance = new GameState();
        }
        return GameState.#theInstance // return existing instance if already exists
    }

    ready() { return this.#phase == this.#phases.READY; }
    gameOver() { return this.#phase == this.#phases.END; }
    paused() { return this.#phase == this.#phases.PAUSE; }
    playing() { return this.#phase == this.#phases.DESCENT || this.#phase == this.#phases.COLLAPSE; }

    startButtonClicked() {
        if (this.playing()) this.pause();
        else if (this.paused()) this.resume();
        else this.startNewGame();
    }

    startNewGame() {
        GameBoard.instance().resetBoard();
        this.#phase = this.#phases.DESCENT;
        this.#descentInfo.msRate = 1000;
        this.#descentInfo.msStepTime = Date.now();
        this.#timer = setInterval(this.handleTimer.bind(this), 100);
    }

    endGame() {
        this.#phase = this.#phases.END;
        if (this.#timer) clearInterval(this.#timer);
        // notes
        adjustStartButton();
    }

    pause() {
        if (!this.playing()) return;
        if (this.#timer) clearInterval(this.#timer);
        this.#resumePhase = this.#phase; // store pre-pause phase
        this.#phase = this.#phases.PAUSE;
    }

    resume() {
        if (this.paused()) {
            this.#phase = this.#resumePhase;
            const msNow = Date.now();
            if (this.#phase == this.#phases.DESCENT) this.#descentInfo.msStepTime = msNow;
            else if (this.#phase == this.#phase.COLLAPSE) this.#collapseStepTime = msNow;
            this.#timer = setInterval(this.handleTimer.bind(this), 100);
        }
    }

    handleTimer() {
        if (this.#phase == this.#phases.DESCENT) this.#stepDescent();
        else if (this.#phase == this.#phases.COLLAPSE) this.#stepCollapse();
    }

    #startDescent() {
        this.#phase = this.#phases.DESCENT;
        this.#descentInfo.msStepTime = Date.now();
        if (!GameBoard.instance().startPiece()) this.endGame();
    }

    #stepDescent() {
        const msNow = Date.now();
        if (msNow - this.#descentInfo.msStepTime < this.#descentInfo.msRate) return;
        this.#descentInfo.msStepTime = msNow;

        if (!GameBoard.instance().offsetPiece(0, 1)) {
            GameBoard.instance().placeActivePiece();
            if (GameBoard.instance().hasCompletedRows()) {
                this.#startRowCollapse();
            } else if (!GameBoard.instance().startPiece()) {
                this.endGame();
            }
        }
        updateDisplay();
    }

    #startRowCollapse() {
        this.#phase = this.#phases.COLLAPSE;
        this.#collapseStepTime = Date.now();
    }

    #stepCollapse() {
        const msNow = Date.now();
        if (msNow - this.#collapseStepTime < 1000) return;

        GameBoard.instance().collapseCompletedRows();
        this.#startDescent();
        updateDisplay();
    }
}

//-------------------------------------------------------------------------------------------------

// GridDisplay class is for displaying the game board composite in the browser

class GridDisplay {
    #bounds;
    #squares;
    static #theInstance = null;

    constructor() {
        this.#squares = Array.from(document.querySelectorAll('.grid div')) // 1D array from grid elements
        this.#bounds = new Rect(0, 0, 10, 20); // REVISIT: find a central place to retrieve the grid dimension
    }

    // Should only be one GridDisplay instance
    static instance() {
        if (!GridDisplay.#theInstance) {
            GridDisplay.#theInstance = new GridDisplay();
        }
        return GridDisplay.#theInstance;
    }

        // #squares is a 1D array; convert 2D coordinates to a 1D index.
        #index(x, y) { return (y - this.#bounds.top) * this.#bounds.width() + (x - this.#bounds.left); }

        width() { return this.#bounds.width(); }
        height() { return this.#bounds.height(); }
        bounds() { return this.#bounds.clone(); }
    
        // color can be a name or hex string
        setColorAt(x, y, color) { this.#squares[this.#index(x,y)].style.backgroundColor = color; }

        // Display the given image within the given area. The area rect can be used to
        // limit the extent of the update (versus always updating the entire board).
        // image is 8-bit with color index values.
        displayImage(image, area) {
            const workArea = this.#bounds.intersection(image.bounds()).intersection(area);
            if (workArea.empty()) return;
            for (let y = workArea.top; y < workArea.bottom; ++y) {
                for (let x = workArea.left; x < workArea.right; ++x) {
                    const colorIndex = image.valueAt(x, y);
                    if (colorIndex != CellColorIndex.TRANSPARENT) {
                        this.setColorAt(x, y, CellColorTable[image.valueAt(x, y)]);
                    } else {
                        this.setColorAt(x, y, "#404040"); // dark gray for now
                    }
                }
            }
        }

}

//-------------------------------------------------------------------------------------------------

function updateDisplay() {
    GameBoard.instance().updateDisplay();
}

function offsetBoardPiece(x, y) {
    // REVISIT: consider calling a GameState function for offset and rotate instead of calling
    // the GameBoard directly. The updateDisplay() call is still probably appropriate here
    // (want to minimize "view" considerations down in the GameState and GameBoard "model").
    if (GameBoard.instance().offsetPiece(x, y)) updateDisplay();
}

function rotateBoardPieceCW() {
    if (GameBoard.instance().rotatePieceCW()) updateDisplay();
}

function rotateBoardPieceCCW() {
    if (GameBoard.instance().rotatePieceCCW()) updateDisplay();
}

//-------------------------------------------------------------------------------------------------

//REVISIT: should we allow for moving the piece up during descent?
function handleKeyDown(event) {
    if (event.shiftKey) {
        switch(event.code) {
            case 'ArrowLeft':   rotateBoardPieceCCW();  break;
            case 'ArrowRight':  rotateBoardPieceCW();   break;
            case 'ArrowDown':   rotateBoardPieceCW();   break;
            case 'ArrowUp':     rotateBoardPieceCCW();  break;
         }
    } else {
        switch (event.code) {
            case 'ArrowLeft':   offsetBoardPiece(-1, 0);   break;
            case 'ArrowRight':  offsetBoardPiece(1, 0);    break;
            case 'ArrowDown':   offsetBoardPiece(0, 1);    break;
            case 'ArrowUp':     offsetBoardPiece(0, -1);   break; // see above REVISIT
       }
    }
}

//-------------------------------------------------------------------------------------------------

function adjustStartButton() {
    const startButton = document.querySelector('#start-button');
    if (GameState.instance().playing()) startButton.value = "Pause";
    else if (GameState.instance().paused()) startButton.value = "Resume";
    else if (GameState.instance().gameOver()) startButton.value = "Play Again";
    else startButton.value = "Play";
}

function handleStartButton() {
    GameState.instance().startButtonClicked();
    adjustStartButton();
    updateDisplay();
}

//-------------------------------------------------------------------------------------------------

function testIndexedImage() {
    const img = makeTImage(CellColorIndex.RED);
    img.visibleBounds(); // force calculation
    const imgClone = img.shallowClone();
    // We expect img and imgClone to share the same memory buffer; altering a value in one should be reflected in the other.
    imgClone.setValueAt(1, 1, CellColorIndex.GREEN);
    console.log("testIndexedImage() img(1,1): " + img.valueAt(1,1) + " imgClone(1,1): " + imgClone.valueAt(1,1));

    imgClone.offset(1, 1);
    console.log("testIndexedImage() img and imgClone visibible overlap: " + (visibleOverlap(img, imgClone) ? "true" : "false"));

    console.log("testIndexedImage() starting visible bounds: " + img.visibleBounds());
    img.moveTo(5, 9);
    console.log("testIndexedImage() visible bounds after move to [5,9]: " + img.visibleBounds());

    const img2 = rotateCCW(img);
    console.log("testIndexedImage() visible bounds after rotate CCW: " + img2.visibleBounds());
}

//-------------------------------------------------------------------------------------------------

function tests() {
    testIndexedImage();
}