
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
const CellColorIndex = Object.freeze({BLACK: 0, RED: 1, GREEN: 2, BLUE: 3, YELLOW: 4, WHITE: 5, TRANSPARENT: 6, GRAY: 7})
const CellColorTable = ["#000000", "#C00000", "#00C000", "#0000C0", "#C0C000", "#FFFFFF", "#000000", "#808080"];

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
            let index = img.#index(0, r); 
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

    // takes a rect from source image and copies it into this image
    copyRect(srcRect, srcImage, dstX, dstY, mergeMode = false) {
        // Translates a shallow copy of the srcImage and srcRect
        // so that the source image and this image are in the same coordinate space
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

    // returns a new image that is a sub rect of this image
    // returns null if rect does not itersect with this image
    subImage(rect) {
        const srcRect = this.#bounds.intersection(rect); // find intersect of rect and this
        if (srcRect.empty()) return null;
        var image = new IndexedImage(srcRect.width(), srcRect.height()); // new image
        image.moveTo(srcRect.left, srcRect.top) // position to location of source rect
        image.copyRect(srcRect, this, srcRect.left, srcRect.top);
        return image;
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

// fills holes and fills in the overhang "shadow" for the purpose of qTable keys redundancy
function fillHolesAndOverhangs(image) {
    const bounds = image.bounds();
    // for each column, scan fom top down
    // for any non-transparent pixel, fill in any transparent pixels below
    for (x = bounds.left; x < bounds.right; ++x) {
        var filling = false;
        for (y = bounds.top; y < bounds.bottom; ++y) {
            if (filling) {
                if (image.valueAt(x, y) == CellColorIndex.TRANSPARENT) {
                    // fill color is arbitrary, just chose white to distinguish from shape colors
                    image.setValueAt(x, y, CellColorIndex.WHITE);
                }
            }
            else {
                filling = (image.valueAt(x, y) != CellColorIndex.TRANSPARENT);
            }
        }
    }
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
// returns an object having the piece and its shape index number
function makeRandomPiece() {
    const makers = [makeBarImage, makeLImage, makeJImage, makeSImage, makeZImage, makeTImage, makeSquareImage];
    const result = {}
    result.index = randomInt(0, makers.length - 1);
    result.piece = makers[result.index](randomPieceColorIndex());
    return result;
}

//-------------------------------------------------------------------------------------------------

//------------------ GAME BOARD ------------------------------

// GameBoard manages an image that is the composite of placed pieces and the active piece.

class GameBoard {
    #compositeImage; // combination of placed pieces and active piece
    #stackImage; // placed pieces
    #activePiece; // descending piece
    #ghostPiece // ghost piece to mirror active piece
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
        this.#ghostPiece = null;
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
        const randomPiece = makeRandomPiece();
        const piece = randomPiece.piece // returns the piece component of the object
        // drop new piece at the top middle of the game board with its bottom row visible
        const visBounds = piece.visibleBounds();
        const left = Math.round((this.bounds().width() - visBounds.width()) / 2); 
        const bottom = 1;
        piece.offset(left - visBounds.left, bottom - visBounds.bottom);

        if (!this.#validPosition(piece)) return false; // caller should end the game

        this.#activePiece = piece;
        this.invalComposite(piece.visibleBounds());
        
        // test code
        // prints in hex and binary
        const stackKey = this.stackTopKey();
        console.log("startPiece() - stack key: " + stackKey.toString(16) + ", " + stackKey.toString(2))

        const pieceKey = randomPiece.index * (2 ** 50); // shift to the upper range to prevent overlap?
        console.log("startPiece() - piece key: " + pieceKey.toString(16) + ", " + pieceKey.toString(2));

        const stateKey = stackKey + pieceKey;
        console.log("startPiece() - state key: " + stateKey.toString(16) + ", " + stateKey.toString(2));

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

    // helper function to call validPosition() later on for qLearning
    isValidPosition(piece) {
        return this.#validPosition(piece);
    }

    // private function to find where to place the ghost piece
    // (how far the active piece could descend before colliding in its current x position)
    #findGhostPosition(piece) {
        let ghost = piece.shallowClone() // shallow clone of the active piece
        
        // move down until invalid position is found
        while (this.#validPosition(ghost)) {
            ghost.offset(0, 1); // trying to reserve use of offsetPiece() for only the activePiece
        }

        // go back one position since the while loop will have performed one too many offsets
        ghost.offset(0, -1);
        return ghost;
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
        //invalidate old active piece location
        if (this.#activePiece) {
            this.invalComposite(this.#activePiece.visibleBounds()); 
        }
        
        // invalidate old ghost piece location
        if (this.#ghostPiece) {
            this.invalComposite(this.#ghostPiece.visibleBounds()); 
        }
        
        // invalidate new active piece location
        if (newPiece) {
            this.invalComposite(newPiece.visibleBounds()); //invalidate new location
        }
        
        // update new piece
        this.#activePiece = newPiece;

        //update the ghost piece whenever the active piece is updated
        if (newPiece) {
            this.#ghostPiece = this.#findGhostPosition(newPiece); //update ghost location based on new activePiece
            this.invalComposite(this.#ghostPiece.visibleBounds()); // invalidate new ghost piece location
        } else {
            this.#ghostPiece = null;
        }
    }

    // Copy the acive piece into the stack of placed pieces
    placeActivePiece() {
        if (this.#activePiece) {
            const visBounds = this.#activePiece.visibleBounds();

            // clearing the ghost piece before merging the activePiece with stack
            // this prevents the placed piece from appearning as the ghost piece for a moment
            if (this.#ghostPiece) {
                this.invalComposite(this.#ghostPiece.visibleBounds())
                this.#ghostPiece = null;
            }
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

    completedRowCount() { return this.#completedRowSet.size; }

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

            // draw ghost piece
            if (this.#ghostPiece) {
                const ghostBounds = this.#ghostPiece.bounds().intersection(this.#invalRect);
                //this.#compositeImage.mergeRect(ghostBounds, this.#ghostPiece.shallowClone())  
                // omitting mergeRect here to draw pixels manually
                // this way we can recolor them differently than activePiece as the composite is updated
                for (let y = ghostBounds.top; y < ghostBounds.bottom; ++y) {
                    for (let x = ghostBounds.left; x < ghostBounds.right; x++) {
                        const value = this.#ghostPiece.valueAt(x, y);
                        if (value != CellColorIndex.TRANSPARENT) {
                            this.#compositeImage.setValueAt(x, y, CellColorIndex.GRAY);
                        }
                    }
                }
            }

            // draw active piece
            if (this.#activePiece) {
                // added const activeBounds to mirror ghostBounds above
                // just for readability and to be consistent
                const activeBounds = this.#activePiece.bounds().intersection(this.#invalRect) 
                this.#compositeImage.mergeRect(activeBounds, this.#activePiece);
            }
            this.#invalRect = Rect.makeEmpty();
        }
    }

    updateDisplay() {
        const area = this.#invalRect;
        if (!area.empty()) {
            this.updateComposite();
            BoardDisplay.instance().displayImage(this.#compositeImage, area);
        }
    }

    // returns an image from the top five rows of the stack image
    stackTopImage() {
        var stackTopBounds = this.#stackImage.bounds();
        const visBounds = this.#stackImage.visibleBounds();
        if (visBounds.empty()) {
            stackTopBounds.top = stackTopBounds.bottom - 5;
        } else {
            // assume that visBounds extends to bottom of the stack image
            if (visBounds.top + 5 > stackTopBounds.bottom) {
                stackTopBounds.top = stackTopBounds.bottom - 5;
            } else {
                stackTopBounds.top = visBounds.top;
                stackTopBounds.bottom = visBounds.top + 5;
            }      
        }
        return this.#stackImage.subImage(stackTopBounds);
    }

    stackTopKey() {
        var stackTopImage = this.stackTopImage();
        fillHolesAndOverhangs(stackTopImage);
        stackTopImage.moveTo(0, 0);
        const stackTopBounds = stackTopImage.bounds();
        StackKeyDisplay.instance().displayImage(stackTopImage, stackTopBounds);

        var keyNum = 0;
        var bitIndex = 0;

        // scan the cells from top to bottom, left to right
        // top left cell corresponds to lowest bit in the 50-bit number
        // bottom right corresponds to highest bit in the 50-bit number
        // this arrangement allows for the key to be consistently calculated

        for (var y = stackTopBounds.top; y < stackTopBounds.bottom; ++y) {
            for (var x = stackTopBounds.left; x < stackTopBounds.right; ++x) {
                const pixelValue = this.#stackImage.valueAt(x, y);
                if (pixelValue!= CellColorIndex.TRANSPARENT) {
                    // need 50 bits so can't use typical bitwise operations (would convert to 32-bit)
                    const bitMask = 2 ** bitIndex;
                    keyNum += bitMask
                }
                ++bitIndex;
            }
        }
        return keyNum
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
    #score
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
    score() { return this.#score;}

    startButtonClicked() {
        if (this.playing()) this.pause();
        else if (this.paused()) this.resume();
        else this.startNewGame();
    }

    startNewGame() {
        GameBoard.instance().resetBoard();
        this.#phase = this.#phases.DESCENT; // begind descent
        this.#descentInfo.msRate = 1000; // descend one row every 1000ms
        this.#descentInfo.msStepTime = Date.now(); // tracking time of last row advance
        this.#timer = setInterval(this.handleTimer.bind(this), 100); // executes handleTimer() every 100ms
    }

    endGame() {
        this.#phase = this.#phases.END;
        if (this.#timer) clearInterval(this.#timer);
        // LATER: don't directly call a UI thing from here (in the model)
        // make an anonymous notification system where the "app" can register (with a function) to be 
        // notified of model changes. It will amount to calling the given callback functions. 
        // That same notification system can also replace calls to updateDisplay() from here in GameState.
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

    offsetPiece(x, y) {
        if (GameBoard.instance().offsetPiece(x, y)) {
            if (y > 0) this.#score++; // score increases by 1 for each manual descent
            updateDisplay();
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
        // if 1000ms haven't passed, return and do not descend yet
        if (msNow - this.#descentInfo.msStepTime < this.#descentInfo.msRate) return;
        this.#descentInfo.msStepTime = msNow;

        // piece is advanced down one row if offset is successful
        // if unsuccessful, the piece is placed where it is.
        if (!GameBoard.instance().offsetPiece(0, 1)) {
            GameBoard.instance().placeActivePiece(); 
            if (GameBoard.instance().hasCompletedRows()) {
                this.#startRowCollapse();
            } else if (!GameBoard.instance().startPiece()) { // game ends if start piece has invalid pos
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

    // selector is in the form '.grid div'
    constructor(selector, bounds) {
        this.#squares = Array.from(document.querySelectorAll(selector)) // 1D array from grid elements
        this.#bounds = bounds
    }

    // #squares is a 1D array; convert 2D coordinates to a 1D index.
    #index(x, y) { return (y - this.#bounds.top) * this.#bounds.width() + (x - this.#bounds.left); }

    width() { return this.#bounds.width(); }
    height() { return this.#bounds.height(); }
    bounds() { return this.#bounds.clone(); }
    
    // color can be a name or hex string
    setColorAt(x, y, color) { 
        // for testing:
        // const idx = this.#index(x, y);
        //     if (!this.#squares[idx]) {
        //         console.error("Bad GridDisplay index?", { x, y, idx, len: this.#squares.length, bounds: this.#bounds });
        //         return; // prevent crash while debugging
        //     }
        //     this.#squares[idx].style.backgroundColor = color;
        this.#squares[this.#index(x,y)].style.backgroundColor = color; 
    
    }

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

// BoardDisplay is for displaying the game board composite in the browser window
class BoardDisplay {
    static #theInstance = null;

    // we intend to only have one BoardDisplay instance
    static instance() {
        if (!BoardDisplay.#theInstance) {
            BoardDisplay.#theInstance = new GridDisplay('.grid div', new Rect(0, 0, 10, 20));
        }
        return BoardDisplay.#theInstance;
    }
}

//-------------------------------------------------------------------------------------------------

// StackKeyDisplay is for displaying the key image for the current pieces stack.
// The key image is the top five rows of the pieces stack with holes and overhangs filled in.

class StackKeyDisplay {
    static #theInstance = null;

    // We intend to have only one StackKeyDisplay instance
    static instance() {
        if (!StackKeyDisplay.#theInstance) {
            StackKeyDisplay.#theInstance = new GridDisplay('.stackKey div', new Rect(0, 0, 10, 5));
        }
        return StackKeyDisplay.#theInstance;
    }
}

//-------------------------------------------------------------------------------------------------


// updates the invalid area
function updateDisplay() {
    GameBoard.instance().updateDisplay();
}

function offsetBoardPiece(x, y) {
    // Manually offsetting piece downward scores points
    // call GameState to handle this since GameState handles scoring
    // GameState handles the display update
    GameState.instance().offsetPiece(x, y)
}

function rotateBoardPieceCW() {
    if (GameBoard.instance().rotatePieceCW()) updateDisplay();
}

function rotateBoardPieceCCW() {
    if (GameBoard.instance().rotatePieceCCW()) updateDisplay();
}

//-------------------------------------------------------------------------------------------------

//REVISIT: should we allow for moving the piece up during descent?
// Esp considering that it would allow the player to delay the descent of the next piece
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


//-------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------

// this is the Q-learning agent
class QLearning {

    constructor(lr = 0.1, gamma = 0.9, epsilon = 0.1) {
        // this is our q table. stores values: { state ==> [q_action_0, q_action_1, ...]}
        this.qTable = new Map(); 
        this.lr = lr; // ALPHA, the learning rate
        this.gamma = gamma; // DISCOUNT FACTOR, how much to value future rewards
        this.epsilon = epsilon; // EXPLORATION RATE, probability a random action (exploration) will be taken
    }

    // returns the qTable entry for the given state
    // available: list of all legal placements for the active piece. comes from enumeratePlacements
    getQ(state, available) {
        // if current state does not exists in qTable, created an entry with values of 0
        if (!this.qTable.has(state)) {
            // creates an array sized to the number of possible placements. Initialized to zeros
            this.qTable.set(state, new Float32Array(available.length)); 
        }
        return this.qTable.get(state);
        
    }

    getAction(state, available){
        // if less than epsilon, explore. else, exploit
        if (Math.random() < this.epsilon) {
            // ~~ is a double bitwise NOT operator, which is apparently faster than math.floor()
            return available[~~(Math.random() * available.length)]; // returns a random action
        }
        const q = this.getQ(state, available);
        return available.reduce((best, a) => q[a] > q[best] ? a : best, available[0]) // returns best known move
    }

    // This is that q-learning function:
    // Q(s, a) ← Q(s, a) + α [r + γ max(a') Q(s', a') − Q(s, a)]
    update(s, a, r, s2, available2) {
        const q = this.getQ(s);
        const maxQ2 = available2.length ? Math.max(...available2.map(a_prime => this.getQ(s2)[a_prime])) : 0;
        q[a] += this.lr * (r + this.gamma * maxQ2 - q[a]); // updating the q-value for this action
    }

    // ----------- HELPER FUNCTIONS -----------------------------

    decay() {
        const decayValue = 0.995; // value could be adjusted later
        this.epsilon = Math.max(0.01, this.epsilon * decayValue);
    }

    reset() {
        this.q.clear();
        this.epsilon = 0.1;
    }

    save() {
        const data = {
            q: Array.from(this.q.entries()),
            lr: this.lr,
            gamma: this.gamma,
            epsilon: this.epsilon
        };
        // This will let me track the contents of the qTable entries after a session
        // I think I can use console.log() to read this too
        // also will allow the agent to pick up where it left off
        localStorage.setItem('tetris_qLearning_ai', JSON.stringify(data));
    }

    load() {
        const saved = localStorage.getItem('tetris_qLearning_ai');
        if (!saved) return false;

        try {
            const data = JSON.parse(saved);
            this.q = new Map(data.q); // creates new map from existing data array in save()
            this.lr = data.lr;
            this.gamma = data.gamma;
            this.epsilon = data.epsilon;
            return true;
        } catch (e) {
            console.error("Failed to load AI state: ", e);
            return false;
        }
    }

    clearStorage() {
        localStorage.removeItem('tetris_qLearning_ai');
    }
}

function enumeratePlacements(board, piece) {
    const placements = [];
    const rotations = getUniqueRotations(piece);

    // iterate through each rotation position
    for (let r = 0; r < rotations.length; r++) {
        const rotated = rotations[r];

        // iterate through each horizontal position
        // -2 and +2 here allow for pieces like "I" to be at the edge of board when rotated
        // but I'm not sure if that's the best way to do this or if the value of 2 is correct
        for (let x = -2; x < board.width() + 2; x++) {
            let testPiece = rotated.shallowClone();
            testPiece.moveTo(x, testPiece.bounds().top);

            // skip if out of bounds
            if (!board.isValidPosition(testPiece)) continue; 

            // this is the same logic as findGhostPosition(piece)
            // is there a better way to just access the findGhostPosition logic?
            while (board.isValidPosition(testPiece)) {
                testPiece.offset(0, 1);
            }
            testPiece.offset(0, -1);

            // example placements entry: placements = [{ rotation: 0, x: 3, piece: <clone> }, ...]
            // I think having rotation and x position will be good if I want to look at the data later
            // ...but might only be necessary to have the testPiece clone itself.
            // The testPiece can be used later to place piece when action is chosen
            if (board.isValidPosition(testPiece)) {
                placements.push({ rotation: r, x, piece: testPiece });
            }
        }
    }
    return placements;
}

// TODO: -----------------------------------------
// add function getUniqueRotations()
// define state index (64-bit)
// define retrieval of top 5 rows of board. Is there a place in code should I access this from?
// and probably lots more :)

// NOTES TO SELF:
// the board is called in enumeratePlacements(). Should this be the top 5 rows, or the whole board?
// I would think the top 5 rows should be used for the key, but not necessarily for enumerating placements.
// It might be unnecessary to have 'available' present in arguments for both getQ() and getAction()
