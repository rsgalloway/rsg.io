#!/bin/bash
# 
# simple image compression script using ffmpeg
#
# $ squash tmp/photos static/img 7
#

# Check if the correct number of arguments are provided
if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <input_folder> <output_folder> <quality>"
    exit 1
fi

INPUT_FOLDER=$1
OUTPUT_FOLDER=$2
QUALITY=$3

# Create the output folder if it does not exist
mkdir -p "$OUTPUT_FOLDER"

# Loop through all jpg files in the input folder
for INPUT_FILE in "$INPUT_FOLDER"/*.jpg; do
    # Extract the filename without the path
    FILENAME=$(basename "$INPUT_FILE")
    OUTPUT_FILE="$OUTPUT_FOLDER/$FILENAME"

    # Check if the input file and output file are the same
    if [ "$INPUT_FILE" != "$OUTPUT_FILE" ]; then
        # Compress the file, allow overwriting, and suppress stdout
        ffmpeg -y -i "$INPUT_FILE" -q:v "$QUALITY" "$OUTPUT_FILE" > /dev/null 2>&1

        echo "Processed $INPUT_FILE -> $OUTPUT_FILE"
    else
        echo "Skipping $INPUT_FILE: input and output files are the same."
    fi
done

echo "All files processed."
