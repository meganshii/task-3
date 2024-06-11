import React, { useState, useRef } from "react";
import { Box, Tab, Tabs, Card, CardContent, Typography, Button, Input ,Grid,CardMedia,Dialog,DialogTitle,DialogContent} from "@mui/material";



const tabLabels = ["Tab One", "Tab Two", "Tab Three", "Tab Four", "Tab Five"];

const initialTabsData = tabLabels.map(() => ({
  files: [],
  filePreviews: [],
  urls: [],
  fileIds: [],  // Add this line
}));

function Fileupload() {
  const [value, setValue] = useState(0);
  const [tabsData, setTabsData] = useState(initialTabsData);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const newFiles = Array.from(event.target.files);
    setTabsData(prevTabsData => {
      const updatedTabsData = [...prevTabsData];
      updatedTabsData[value].files = newFiles;

      const previews = newFiles.map(file => URL.createObjectURL(file));
      updatedTabsData[value].filePreviews = previews;

      return updatedTabsData;
    });
  };

  const handleFileUpload = async () => {
    const currentFiles = tabsData[value].files;

    if (currentFiles.length > 0) {
      const formData = new FormData();
      formData.append("tabLabel", tabLabels[value]); // Include the tab label

      currentFiles.forEach((file) => {
        formData.append("files", file);
      });

      try {
        const response = await fetch("http://localhost:3001/upload", {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText);
        }

        const data = await response.json();

        if (data.files) {
          setTabsData(prevTabsData => {
            const updatedTabsData = [...prevTabsData];
            updatedTabsData[value].urls = data.files.map(file => file.webViewLink).join(", "); // Assuming the server returns webViewLink
            updatedTabsData[value].fileIds = data.files.map(file => file.id); // Assuming the server returns file ID
            return updatedTabsData;
          });
        }

        alert("Files uploaded to drive");
        console.log("Uploaded files:", data.files);
      } catch (error) {
        console.error('Error during file upload:', error.message);
      }
    }
  };
  const handleDelete = async (index) => {
    const fileIdToDelete = tabsData[value].fileIds[index];

    // Delete the file from the drive
    try {
      const response = await fetch(`http://localhost:3001/delete/${fileIdToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete file from drive');
      }

      // If file deletion from the drive was successful, update the state
      setTabsData(prevTabsData => {
        const updatedTabsData = [...prevTabsData];
        updatedTabsData[value] = {
          ...updatedTabsData[value],
          files: updatedTabsData[value].files.filter((_, i) => i !== index),
          filePreviews: updatedTabsData[value].filePreviews.filter((_, i) => i !== index),
          fileIds: updatedTabsData[value].fileIds.filter((_, i) => i !== index),
        };
        return updatedTabsData;
      });

      alert('File deleted from drive');
    } catch (error) {
      console.error('Error deleting file from drive:', error.message);
      alert('Failed to delete file from drive');
    }
  };

  const handlePreview = (preview) => {
    setPreviewImage(preview);
    setPreviewOpen(true);
  };

  const handlePreviewClose = () => {
    setPreviewOpen(false);
    setPreviewImage(null);
  };

  const handleTabChange = (event, newValue) => {
    setValue(newValue);
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#f0f0f0",
      }}
    >
      <Card sx={{ width: "600px", height: "500px" }}>
        <Tabs value={value} onChange={handleTabChange} centered>
          {tabLabels.map((label, index) => (
            <Tab label={label} key={index} />
          ))}
        </Tabs>
        <CardContent>
          <Box  sx={{ maxHeight: "300px", overflowY: "auto" }}>
          <Grid container spacing={2}>
            {tabsData[value].filePreviews.map((preview, index) => (
              <Grid item xs={6} key={index}>
                <Card>
                
                  <CardMedia
                   onClick={()=>handlePreview(preview)}
                    component="img"
                    alt="Uploaded Image"
                    height="140"
                    image={preview}
                  />
                  <CardContent>
                    <Typography variant="body2" color="textSecondary">
                      {tabsData[value].files[index].name}
                    </Typography>
                    
                    <Button onClick={() => handleDelete(index)}>Delete</Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          </Box>
          <form>
            <Input
              id="outlined-basic"
              label="Outlined"
              variant="outlined"
              type="file"
              name="file"
              inputProps={{
                multiple: true
              }}
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <Button onClick={handleFileUpload}>Submit</Button>
          </form>
        </CardContent>
      </Card>
      <Dialog open={previewOpen} onClose={handlePreviewClose}>
        <DialogTitle>Image Preview</DialogTitle>
        <DialogContent>
          {previewImage && <img src={previewImage} alt="Preview" style={{ width: '100%' }} />}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default Fileupload;
