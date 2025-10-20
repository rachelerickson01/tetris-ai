
// Event listener - triggers when HTML file is finished loading
document.addEventListener('DOMContentLoaded', () => {

    const grid = document.querySelector('.grid') // selects the grid class from index.html
    let squares = Array.from(document.querySelectorAll('.grid div')) //  array from grid elements 
    const gridSpacing = 10
    const scoreDisplay = document.querySelector('#score')
    const startButton = document.querySelector('#start-button')

    console.log(squares)
})

//-------------------------------------------------------------------------------------------------

// dictionary for color picking in randomPieceColorIndex()
const CellColorIndex = Object.freeze({BLACK: 0, RED: 1, GREEN: 2, BLUE: 3, YELLOW: 4, WHITE: 5, TRANSPARENT: 6})
const CellColorTable = ["#000000", "#C00000", "#00C000", "#0000C0", "#C0C000", "#FFFFFF", "#000000"];

// linear interpolation to find random spot between min and max values
function linearInterp(a, b, t) { return a + t * (b - a); };
function randomInt(min, max) { return Math.round(linearInterp(min, max, Math.random())); }

// generates a color index for the randomly selected piece color
function randomPieceColorIndex() {
    const rand = Math.random(); // is there a use for this later?
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
        return (this.left >= this.right || this.top >= bottom);
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
            let index = img.index(0, r); // should make index private?
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


